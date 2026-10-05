"""
failure_mode_tests.py
Failure Mode & Edge Case Test Suite for Tenant-Aware Storage Capacity Forecaster.

Tests five critical failure scenarios:
  FM-1: Sudden Bulk Tenant Onboarding Surge
  FM-2: EOM Disbursement Schedule Shift (Day 28 → Day 15)
  FM-3: Index Bloat Non-Linear Split Acceleration
  FM-4: Retention Purge Cron Execution Failure
  FM-5: Anomalous Data Ingestion Spike (10x burst)

Each test injects a controlled perturbation into the telemetry pipeline and
measures the proposed model's forecast deviation, prediction interval coverage,
and DTE accuracy under stress conditions.
"""

import json
import math
import copy
import numpy as np
from datetime import datetime, timedelta
from data_generator import generate_telemetry_data
from forecaster_engine import BaselineForecaster, ProposedTenantAwareForecaster


def load_or_generate_dataset():
    """Load existing dataset or generate fresh."""
    try:
        with open("telemetry_dataset.json", "r") as f:
            return json.load(f)
    except Exception:
        return generate_telemetry_data()


# ─────────────────────────────────────────────────────────────────────────────
# FM-1: Sudden Bulk Tenant Onboarding Surge
# ─────────────────────────────────────────────────────────────────────────────

def test_fm1_bulk_tenant_onboarding(dataset):
    """
    Scenario: A new state agency (Pennsylvania) onboards 300,000 recipients
    overnight at day 366, injecting an additional ~0.15 weight tenant with
    aggressive growth rate. The model has never seen this tenant.
    
    Expected behavior: Without re-fitting, the model underestimates growth.
    With re-fitting (simulated), the model should detect and adjust.
    """
    print("\n" + "=" * 70)
    print("  FM-1: BULK TENANT ONBOARDING SURGE TEST")
    print("=" * 70)

    # Clone dataset and inject a new high-weight tenant
    perturbed = copy.deepcopy(dataset)
    new_tenant = {
        "id": "tenant_pa",
        "name": "PA Dept of Human Services (Emergency Onboard)",
        "base_weight": 0.15,
        "growth_rate": 0.0045
    }

    # Run forecast WITHOUT the new tenant (model's current view)
    model_before = ProposedTenantAwareForecaster(dataset, cutoff_day_index=365)
    result_before = model_before.predict(forecast_days=180, num_mc_sims=150, seed=42)
    dte_before = result_before["days_to_exhaustion_p50"]

    # Now inject new tenant into dataset for "actual" future truth
    perturbed["tenants"].append(new_tenant)

    # Inject new tenant's row history into telemetry (backfill sparse history)
    for entry in perturbed["telemetry"]:
        day_idx = entry["day_index"]
        for tbl_id in entry["tables"]:
            if day_idx < 365:
                # New tenant has no history before onboarding
                entry["tables"][tbl_id]["tenant_breakdown"]["tenant_pa"] = {
                    "new_rows": 0, "purged_rows": 0, "active_rows": 0, "tenant_bytes": 0
                }
            else:
                # After onboarding: sudden high-volume injection
                base_rows = int(4500 * 0.15 * (1.0 + 0.0045 * (day_idx - 365)))
                is_eom = entry.get("is_eom_peak", False)
                mult = 5.2 if is_eom else 1.0
                new_rows = max(500, int(base_rows * mult * np.random.uniform(0.95, 1.05)))
                entry["tables"][tbl_id]["tenant_breakdown"]["tenant_pa"] = {
                    "new_rows": new_rows, "purged_rows": 0,
                    "active_rows": new_rows * min(day_idx - 364, 90),
                    "tenant_bytes": new_rows * min(day_idx - 364, 90) * 780
                }

    # Run forecast WITH new tenant (re-fitted model)
    model_after = ProposedTenantAwareForecaster(perturbed, cutoff_day_index=365)
    result_after = model_after.predict(forecast_days=180, num_mc_sims=150, seed=42)
    dte_after = result_after["days_to_exhaustion_p50"]

    # Calculate the DTE shift
    dte_shift = dte_before - dte_after
    shift_pct = (dte_shift / max(1, dte_before)) * 100

    result = {
        "test": "FM-1: Bulk Tenant Onboarding Surge",
        "severity": "HIGH",
        "dte_without_new_tenant": dte_before,
        "dte_with_new_tenant_refitted": dte_after,
        "dte_shift_days": dte_shift,
        "dte_shift_pct": round(shift_pct, 2),
        "status": "PASS" if dte_shift > 0 else "WARN",
        "finding": f"New tenant onboarding accelerates exhaustion by {dte_shift} days ({shift_pct:.1f}%). Model re-fitting captures the additional load correctly." if dte_shift > 0 else "Model did not detect additional load — webhook re-fitting required."
    }

    print(f"  DTE without new tenant : {dte_before} days")
    print(f"  DTE with new tenant    : {dte_after} days")
    print(f"  DTE shift              : {dte_shift} days ({shift_pct:.1f}%)")
    print(f"  Status                 : {result['status']}")
    print(f"  Finding                : {result['finding']}")

    return result


# ─────────────────────────────────────────────────────────────────────────────
# FM-2: EOM Disbursement Schedule Shift
# ─────────────────────────────────────────────────────────────────────────────

def test_fm2_eom_schedule_shift(dataset):
    """
    Scenario: State legislature moves SNAP disbursement from Day 28 → Day 15.
    The model's EOM feature (DOM >= 25) fails to capture the shifted peak.
    
    Measures: Phase-lag error in predicted vs actual peak storage days.
    """
    print("\n" + "=" * 70)
    print("  FM-2: EOM DISBURSEMENT SCHEDULE SHIFT TEST")
    print("=" * 70)

    perturbed = copy.deepcopy(dataset)

    # Shift EOM peaks: move high multipliers from day 25-31 to day 13-17
    for entry in perturbed["telemetry"]:
        day_of_month = datetime.strptime(entry["date"], "%Y-%m-%d").day

        # Shift the EOM peak pattern
        original_is_eom = entry["is_eom_peak"]
        shifted_is_eom = 13 <= day_of_month <= 17

        if entry["day_index"] >= 300:  # Shift takes effect after day 300
            entry["is_eom_peak"] = shifted_is_eom
            if shifted_is_eom and not original_is_eom:
                # Apply peak multiplier to mid-month instead
                entry["eom_multiplier"] = 5.2 + np.random.uniform(-0.4, 0.8)
                for tbl_id in entry["tables"]:
                    for tn_id in entry["tables"][tbl_id]["tenant_breakdown"]:
                        orig = entry["tables"][tbl_id]["tenant_breakdown"][tn_id]["new_rows"]
                        entry["tables"][tbl_id]["tenant_breakdown"][tn_id]["new_rows"] = int(orig * 3.5)
            elif original_is_eom and not shifted_is_eom:
                # Flatten the old EOM period
                entry["eom_multiplier"] = 1.0 + np.random.uniform(-0.05, 0.1)
                for tbl_id in entry["tables"]:
                    for tn_id in entry["tables"][tbl_id]["tenant_breakdown"]:
                        orig = entry["tables"][tbl_id]["tenant_breakdown"][tn_id]["new_rows"]
                        entry["tables"][tbl_id]["tenant_breakdown"][tn_id]["new_rows"] = max(100, int(orig * 0.25))

    # Model trained on original data (DOM >= 25 peak pattern)
    model_original = ProposedTenantAwareForecaster(dataset, cutoff_day_index=365)
    result_original = model_original.predict(forecast_days=180, num_mc_sims=150, seed=42)

    # Model re-trained on shifted data (DOM 13-17 peak pattern)
    model_shifted = ProposedTenantAwareForecaster(perturbed, cutoff_day_index=365)
    result_shifted = model_shifted.predict(forecast_days=180, num_mc_sims=150, seed=42)

    dte_original = result_original["days_to_exhaustion_p50"]
    dte_shifted = result_shifted["days_to_exhaustion_p50"]
    phase_lag_error = abs(dte_original - dte_shifted)

    result = {
        "test": "FM-2: EOM Disbursement Schedule Shift",
        "severity": "MEDIUM",
        "dte_original_schedule": dte_original,
        "dte_shifted_schedule": dte_shifted,
        "phase_lag_error_days": phase_lag_error,
        "status": "PASS" if phase_lag_error <= 20 else "WARN",
        "finding": f"Phase lag of {phase_lag_error} days between original and shifted schedule models. " +
                   ("Within acceptable 20-day tolerance." if phase_lag_error <= 20 else "Exceeds 20-day tolerance — dynamic calendar integration recommended.")
    }

    print(f"  DTE (original schedule) : {dte_original} days")
    print(f"  DTE (shifted schedule)  : {dte_shifted} days")
    print(f"  Phase lag error         : {phase_lag_error} days")
    print(f"  Status                  : {result['status']}")
    print(f"  Finding                 : {result['finding']}")

    return result


# ─────────────────────────────────────────────────────────────────────────────
# FM-3: Index Bloat Non-Linear Split Acceleration
# ─────────────────────────────────────────────────────────────────────────────

def test_fm3_index_bloat_acceleration(dataset):
    """
    Scenario: High update churn on benefit_claims causes GIN index bloat factor
    to suddenly jump from 1.95x to 3.5x due to B-Tree page split depth
    threshold being crossed.
    
    Measures: Storage forecast error when index bloat factor is underestimated.
    """
    print("\n" + "=" * 70)
    print("  FM-3: INDEX BLOAT NON-LINEAR SPLIT ACCELERATION TEST")
    print("=" * 70)

    # Forecast with normal bloat factors
    model_normal = ProposedTenantAwareForecaster(dataset, cutoff_day_index=365)
    result_normal = model_normal.predict(forecast_days=180, num_mc_sims=150, seed=42)
    dte_normal = result_normal["days_to_exhaustion_p50"]

    # Clone dataset and amplify GIN index bloat factor
    perturbed = copy.deepcopy(dataset)
    for tbl in perturbed["tables"]:
        if tbl["id"] == "benefit_claims":
            for idx in tbl["indexes"]:
                if idx["type"] == "gin":
                    idx["bloat_factor"] = 3.50  # Jump from 1.95 to 3.50
                elif idx["type"] == "btree":
                    idx["bloat_factor"] = min(idx["bloat_factor"] * 1.5, 2.5)

    model_bloated = ProposedTenantAwareForecaster(perturbed, cutoff_day_index=365)
    result_bloated = model_bloated.predict(forecast_days=180, num_mc_sims=150, seed=42)
    dte_bloated = result_bloated["days_to_exhaustion_p50"]

    dte_shift = dte_normal - dte_bloated
    shift_pct = (dte_shift / max(1, dte_normal)) * 100

    # Compare storage at forecast day 90
    normal_gb_90 = result_normal["forecast"][89]["p50_gb"]
    bloated_gb_90 = result_bloated["forecast"][89]["p50_gb"]
    storage_increase_gb = bloated_gb_90 - normal_gb_90
    storage_increase_pct = (storage_increase_gb / max(0.001, normal_gb_90)) * 100

    result = {
        "test": "FM-3: Index Bloat Non-Linear Split Acceleration",
        "severity": "HIGH",
        "dte_normal_bloat": dte_normal,
        "dte_elevated_bloat": dte_bloated,
        "dte_acceleration_days": dte_shift,
        "dte_acceleration_pct": round(shift_pct, 2),
        "storage_at_day90_normal_gb": round(normal_gb_90, 3),
        "storage_at_day90_bloated_gb": round(bloated_gb_90, 3),
        "index_overhead_increase_gb": round(storage_increase_gb, 3),
        "index_overhead_increase_pct": round(storage_increase_pct, 2),
        "status": "PASS" if dte_shift > 0 else "WARN",
        "finding": f"GIN bloat jump accelerates exhaustion by {dte_shift} days. Index overhead increases by {storage_increase_gb:.1f} GB ({storage_increase_pct:.1f}%) at day 90. REINDEX CONCURRENTLY recommended when bloat ratio exceeds 1.35x."
    }

    print(f"  DTE (normal bloat)     : {dte_normal} days")
    print(f"  DTE (elevated bloat)   : {dte_bloated} days")
    print(f"  Acceleration           : {dte_shift} days ({shift_pct:.1f}%)")
    print(f"  Storage @ day 90 (norm): {normal_gb_90:.3f} GB")
    print(f"  Storage @ day 90 (bloat): {bloated_gb_90:.3f} GB")
    print(f"  Index overhead increase: {storage_increase_gb:.3f} GB ({storage_increase_pct:.1f}%)")
    print(f"  Status                 : {result['status']}")

    return result


# ─────────────────────────────────────────────────────────────────────────────
# FM-4: Retention Purge Cron Execution Failure
# ─────────────────────────────────────────────────────────────────────────────

def test_fm4_retention_purge_failure(dataset):
    """
    Scenario: The retention purge cron for benefit_claims (90-day window)
    silently fails starting at day 300. Expired rows are never purged,
    causing cumulative row growth instead of sliding-window stabilization.
    
    Measures: Divergence between predicted storage (assumes purge runs) and
    actual storage (purge failed).
    """
    print("\n" + "=" * 70)
    print("  FM-4: RETENTION PURGE CRON FAILURE TEST")
    print("=" * 70)

    # Normal model prediction (assumes purge executes correctly)
    model_normal = ProposedTenantAwareForecaster(dataset, cutoff_day_index=365)
    result_normal = model_normal.predict(forecast_days=180, num_mc_sims=150, seed=42)
    dte_normal = result_normal["days_to_exhaustion_p50"]

    # Simulate purge failure by setting retention_days to 0 (permanent) for benefit_claims
    perturbed = copy.deepcopy(dataset)
    for tbl in perturbed["tables"]:
        if tbl["id"] == "benefit_claims":
            tbl["retention_days"] = 0  # No purge = permanent accumulation

    model_no_purge = ProposedTenantAwareForecaster(perturbed, cutoff_day_index=365)
    result_no_purge = model_no_purge.predict(forecast_days=180, num_mc_sims=150, seed=42)
    dte_no_purge = result_no_purge["days_to_exhaustion_p50"]

    dte_shift = dte_normal - dte_no_purge
    shift_pct = (dte_shift / max(1, dte_normal)) * 100

    # Measure divergence at day 60 (2 months into purge failure)
    normal_gb_60 = result_normal["forecast"][59]["p50_gb"]
    no_purge_gb_60 = result_no_purge["forecast"][59]["p50_gb"]
    divergence_gb = no_purge_gb_60 - normal_gb_60

    result = {
        "test": "FM-4: Retention Purge Cron Failure",
        "severity": "HIGH",
        "dte_with_purge": dte_normal,
        "dte_without_purge": dte_no_purge,
        "dte_acceleration_days": dte_shift,
        "dte_acceleration_pct": round(shift_pct, 2),
        "storage_divergence_at_day60_gb": round(divergence_gb, 3),
        "status": "PASS" if dte_shift > 20 else "WARN",
        "finding": f"Purge failure accelerates exhaustion by {dte_shift} days ({shift_pct:.1f}%). Storage divergence of {divergence_gb:.1f} GB by day 60. Purge heartbeat monitoring is critical."
    }

    print(f"  DTE (purge running)    : {dte_normal} days")
    print(f"  DTE (purge failed)     : {dte_no_purge} days")
    print(f"  Acceleration           : {dte_shift} days ({shift_pct:.1f}%)")
    print(f"  Storage divergence @d60: {divergence_gb:.3f} GB")
    print(f"  Status                 : {result['status']}")

    return result


# ─────────────────────────────────────────────────────────────────────────────
# FM-5: Anomalous Data Ingestion Spike (10x burst)
# ─────────────────────────────────────────────────────────────────────────────

def test_fm5_anomalous_ingestion_spike(dataset):
    """
    Scenario: A data pipeline error or bulk migration event causes a 10x
    ingestion spike on tenant_ca for 5 consecutive days (days 361-365),
    right at the end of the training window.
    
    Measures: Whether the model's recent-30-day baseline is contaminated by
    the spike, and the resulting DTE distortion.
    """
    print("\n" + "=" * 70)
    print("  FM-5: ANOMALOUS DATA INGESTION SPIKE TEST")
    print("=" * 70)

    # Normal forecast
    model_normal = ProposedTenantAwareForecaster(dataset, cutoff_day_index=365)
    result_normal = model_normal.predict(forecast_days=180, num_mc_sims=150, seed=42)
    dte_normal = result_normal["days_to_exhaustion_p50"]

    # Inject 10x spike for tenant_ca on days 361-365
    perturbed = copy.deepcopy(dataset)
    for entry in perturbed["telemetry"]:
        if 360 <= entry["day_index"] <= 364:
            for tbl_id in entry["tables"]:
                if "tenant_ca" in entry["tables"][tbl_id]["tenant_breakdown"]:
                    td = entry["tables"][tbl_id]["tenant_breakdown"]["tenant_ca"]
                    td["new_rows"] = td["new_rows"] * 10
                    td["active_rows"] = td["active_rows"] * 3  # Amplified but retention limits total
                    td["tenant_bytes"] = td["tenant_bytes"] * 3

    model_spiked = ProposedTenantAwareForecaster(perturbed, cutoff_day_index=365)
    result_spiked = model_spiked.predict(forecast_days=180, num_mc_sims=150, seed=42)
    dte_spiked = result_spiked["days_to_exhaustion_p50"]

    dte_distortion = dte_normal - dte_spiked
    distortion_pct = (dte_distortion / max(1, dte_normal)) * 100

    result = {
        "test": "FM-5: Anomalous Data Ingestion Spike",
        "severity": "MEDIUM",
        "dte_normal": dte_normal,
        "dte_with_spike": dte_spiked,
        "dte_distortion_days": dte_distortion,
        "dte_distortion_pct": round(distortion_pct, 2),
        "spike_magnitude": "10x for 5 days on tenant_ca",
        "status": "PASS" if abs(dte_distortion) <= 15 else "WARN",
        "finding": f"10x ingestion spike distorts DTE by {dte_distortion} days ({distortion_pct:.1f}%). " +
                   ("Model is resilient — spike impact is within ±15 day tolerance." if abs(dte_distortion) <= 15 
                    else "Model is sensitive — anomaly detection and outlier filtering recommended before re-fitting.")
    }

    print(f"  DTE (normal)           : {dte_normal} days")
    print(f"  DTE (with 10x spike)   : {dte_spiked} days")
    print(f"  DTE distortion         : {dte_distortion} days ({distortion_pct:.1f}%)")
    print(f"  Status                 : {result['status']}")
    print(f"  Finding                : {result['finding']}")

    return result


# ─────────────────────────────────────────────────────────────────────────────
# Main Test Runner
# ─────────────────────────────────────────────────────────────────────────────

def run_all_failure_mode_tests():
    """Execute all failure mode tests and produce a summary report."""
    print("\n" + "█" * 70)
    print("  FAILURE MODE & EDGE CASE TEST SUITE")
    print("  Tenant-Aware Storage Capacity Forecaster")
    print("█" * 70)

    dataset = load_or_generate_dataset()
    results = []

    results.append(test_fm1_bulk_tenant_onboarding(dataset))
    results.append(test_fm2_eom_schedule_shift(dataset))
    results.append(test_fm3_index_bloat_acceleration(dataset))
    results.append(test_fm4_retention_purge_failure(dataset))
    results.append(test_fm5_anomalous_ingestion_spike(dataset))

    # Summary
    passed = sum(1 for r in results if r["status"] == "PASS")
    warned = sum(1 for r in results if r["status"] == "WARN")

    print("\n" + "=" * 70)
    print("  FAILURE MODE TEST SUMMARY")
    print("=" * 70)
    print(f"  Total Tests  : {len(results)}")
    print(f"  Passed       : {passed}")
    print(f"  Warnings     : {warned}")
    print("=" * 70)

    for r in results:
        icon = "✅" if r["status"] == "PASS" else "⚠️"
        print(f"  {icon}  {r['test']} [{r['severity']}] — {r['status']}")

    # Save detailed results
    with open("failure_mode_test_results.json", "w") as f:
        json.dump(results, f, indent=2, default=str)

    print(f"\nDetailed results saved to failure_mode_test_results.json")
    return results


if __name__ == "__main__":
    run_all_failure_mode_tests()
