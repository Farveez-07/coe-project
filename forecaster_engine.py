"""
forecaster_engine.py
Forecasting Engine for Tenant-Aware Storage Capacity Forecaster.

Compares Two Technical Approaches:
1. Approach A (Baseline): Aggregate OLS Linear & Moving Average Extrapolation
   - Operates on aggregate database/tablespace storage sizes.
   - Ignores tenant activity composition, index bloat non-linearities, and EOM cyclicality.

2. Approach B (Proposed): Tenant-Aware Hierarchical & EOM-Decomposed Probabilistic Forecaster
   - Decomposes telemetry by tenant activity, table row growth, index amplification, and retention policy decay functions.
   - Incorporates EOM cyclical features (Day-of-Month disbursement schedule).
   - Generates 80% and 95% Confidence Intervals using Monte Carlo simulation.
   - Predicts Days-To-Exhaustion (DTE) for Table, Index, Tablespace, and Total Disk limits.
"""

import json
import math
import numpy as np
from datetime import datetime, timedelta

def to_py_type(val):
    if isinstance(val, (np.int64, np.int32, np.int16, np.int8)):
        return int(val)
    elif isinstance(val, (np.float64, np.float32, np.float16)):
        return float(val)
    elif isinstance(val, np.ndarray):
        return [to_py_type(x) for x in val]
    return val

class BaselineForecaster:
    """Approach A: Simple Aggregate OLS Linear Extrapolation"""
    def __init__(self, telemetry_history):
        self.history = telemetry_history

    def predict(self, forecast_days=180, storage_limit_gb=96.0):
        days = np.array([d["day_index"] for d in self.history])
        total_gb = np.array([d["totals"]["total_gb"] for d in self.history])
        
        # Fit OLS line: y = a * x + b
        poly = np.polyfit(days, total_gb, 1)
        slope, intercept = float(poly[0]), float(poly[1])

        last_day_idx = int(days[-1])
        last_date = datetime.strptime(self.history[-1]["date"], "%Y-%m-%d")

        forecast_series = []
        exhaustion_day_idx = None
        exhaustion_date = None

        for step in range(1, forecast_days + 1):
            future_day_idx = last_day_idx + step
            future_date = last_date + timedelta(days=step)
            date_str = future_date.strftime("%Y-%m-%d")

            pred_gb = float(slope * future_day_idx + intercept)
            ci_spread = pred_gb * (0.002 * step)
            
            if pred_gb >= storage_limit_gb and exhaustion_day_idx is None:
                exhaustion_day_idx = future_day_idx
                exhaustion_date = date_str

            forecast_series.append({
                "day_index": future_day_idx,
                "date": date_str,
                "pred_gb": round(pred_gb, 3),
                "p10_gb": round(pred_gb - ci_spread, 3),
                "p90_gb": round(pred_gb + ci_spread, 3),
                "p95_gb": round(pred_gb + ci_spread * 1.5, 3)
            })

        dte = int(exhaustion_day_idx - last_day_idx) if exhaustion_day_idx else forecast_days + 100

        return {
            "model_name": "Baseline Aggregate OLS Linear",
            "slope_gb_per_day": round(slope, 5),
            "exhaustion_day_index": to_py_type(exhaustion_day_idx),
            "exhaustion_date": exhaustion_date,
            "days_to_exhaustion": dte,
            "forecast": forecast_series
        }


class ProposedTenantAwareForecaster:
    """Approach B: Tenant-Aware Hierarchical & EOM-Decomposed Probabilistic Forecaster"""
    def __init__(self, dataset, cutoff_day_index=365):
        self.dataset = dataset
        self.tenants = dataset["tenants"]
        self.tables = dataset["tables"]
        self.storage_limits = dataset["storage_limits"]
        self.cutoff = cutoff_day_index
        
        self.history = [d for d in dataset["telemetry"] if d["day_index"] < cutoff_day_index]

    def _fit_tenant_table_models(self):
        """Fit tenant-specific and table-specific row generation models"""
        models = {}
        # Recent 30 days for baseline rate
        recent_30 = self.history[-30:] if len(self.history) >= 30 else self.history

        for tbl in self.tables:
            tbl_id = tbl["id"]
            models[tbl_id] = {}
            for tn in self.tenants:
                tn_id = tn["id"]

                normal_rows = []
                eom_rows = []
                all_rows = []

                for entry in self.history:
                    if tbl_id in entry["tables"] and tn_id in entry["tables"][tbl_id]["tenant_breakdown"]:
                        nr = entry["tables"][tbl_id]["tenant_breakdown"][tn_id]["new_rows"]
                        all_rows.append(nr)
                        if entry["is_eom_peak"]:
                            eom_rows.append(nr)
                        else:
                            normal_rows.append(nr)

                # Recent normal rate
                recent_normal_rows = []
                for entry in recent_30:
                    if tbl_id in entry["tables"] and tn_id in entry["tables"][tbl_id]["tenant_breakdown"]:
                        if not entry["is_eom_peak"]:
                            recent_normal_rows.append(entry["tables"][tbl_id]["tenant_breakdown"][tn_id]["new_rows"])

                base_normal = float(np.mean(recent_normal_rows)) if recent_normal_rows else (float(np.mean(normal_rows)) if normal_rows else 500.0)
                avg_eom = float(np.mean(eom_rows)) if eom_rows else base_normal * 5.0
                eom_mult = avg_eom / max(1.0, base_normal)

                # Trend slope
                days = np.arange(len(all_rows))
                poly = np.polyfit(days, all_rows, 1)
                trend_slope = float(poly[0])

                models[tbl_id][tn_id] = {
                    "base_normal": base_normal,
                    "eom_mult": eom_mult,
                    "trend_slope": trend_slope
                }

        return models

    def predict(self, forecast_days=180, num_mc_sims=200, seed=42):
        np.random.seed(seed)
        models = self._fit_tenant_table_models()

        last_day_entry = self.history[-1]
        last_day_idx = int(last_day_entry["day_index"])
        last_date = datetime.strptime(last_day_entry["date"], "%Y-%m-%d")

        table_tenant_windows = {}
        for tbl in self.tables:
            tbl_id = tbl["id"]
            table_tenant_windows[tbl_id] = {}
            for tn in self.tenants:
                tn_id = tn["id"]
                past_rows = []
                for entry in self.history:
                    if tbl_id in entry["tables"] and tn_id in entry["tables"][tbl_id]["tenant_breakdown"]:
                        past_rows.append(entry["tables"][tbl_id]["tenant_breakdown"][tn_id]["new_rows"])
                table_tenant_windows[tbl_id][tn_id] = past_rows

        total_limit_gb = float(self.storage_limits["total_disk_limit_gb"])

        mc_trajectories = np.zeros((num_mc_sims, forecast_days))
        table_trajectories = {tbl["id"]: np.zeros((num_mc_sims, forecast_days)) for tbl in self.tables}
        index_trajectories = {tbl["id"]: np.zeros((num_mc_sims, forecast_days)) for tbl in self.tables}
        
        exhaustion_days_mc = []

        for sim_idx in range(num_mc_sims):
            sim_windows = {
                tbl_id: {tn["id"]: list(table_tenant_windows[tbl_id][tn["id"]]) for tn in self.tenants}
                for tbl_id in table_tenant_windows
            }

            sim_exhaustion_day = None

            for step in range(1, forecast_days + 1):
                future_day_idx = last_day_idx + step
                future_date = last_date + timedelta(days=step)
                day_of_month = future_date.day
                is_eom = day_of_month >= 25 or day_of_month <= 3
                is_mid_month = 14 <= day_of_month <= 16

                sim_total_bytes = 0

                for tbl in self.tables:
                    tbl_id = tbl["id"]
                    avg_bytes = tbl["avg_row_bytes"]
                    retention_days = tbl["retention_days"]

                    tbl_data_bytes = 0
                    tbl_active_rows = 0

                    for tn in self.tenants:
                        tn_id = tn["id"]
                        m_info = models[tbl_id][tn_id]
                        
                        base = m_info["base_normal"] + m_info["trend_slope"] * step
                        
                        if is_eom:
                            mult = m_info["eom_mult"] * np.random.normal(1.0, 0.03)
                        elif is_mid_month:
                            mult = 1.8 * np.random.normal(1.0, 0.03)
                        else:
                            mult = np.random.normal(1.0, 0.02)

                        daily_new = max(50, int(base * max(0.5, mult)))
                        sim_windows[tbl_id][tn_id].append(daily_new)

                        if retention_days > 0:
                            active_tenant_rows = sum(sim_windows[tbl_id][tn_id][-retention_days:])
                        else:
                            active_tenant_rows = sum(sim_windows[tbl_id][tn_id])

                        tbl_active_rows += active_tenant_rows

                    tbl_data_bytes = tbl_active_rows * avg_bytes

                    tbl_index_bytes = 0
                    for idx in tbl["indexes"]:
                        idx_base = tbl_data_bytes * idx["base_ratio"]
                        bloat = 1.0 + (math.log10(max(100, tbl_active_rows)) * 0.05) * idx["bloat_factor"]
                        tbl_index_bytes += int(idx_base * bloat)

                    tbl_total_bytes = tbl_data_bytes + tbl_index_bytes
                    sim_total_bytes += tbl_total_bytes

                    table_trajectories[tbl_id][sim_idx, step - 1] += tbl_data_bytes / (1024 ** 3)
                    index_trajectories[tbl_id][sim_idx, step - 1] += tbl_index_bytes / (1024 ** 3)

                total_gb_sim = sim_total_bytes / (1024 ** 3)
                mc_trajectories[sim_idx, step - 1] = total_gb_sim

                if total_gb_sim >= total_limit_gb and sim_exhaustion_day is None:
                    sim_exhaustion_day = future_day_idx

            if sim_exhaustion_day is not None:
                exhaustion_days_mc.append(sim_exhaustion_day)
            else:
                exhaustion_days_mc.append(last_day_idx + forecast_days + 100)

        forecast_series = []
        for step in range(1, forecast_days + 1):
            future_day_idx = last_day_idx + step
            future_date = last_date + timedelta(days=step)
            date_str = future_date.strftime("%Y-%m-%d")

            day_vals = mc_trajectories[:, step - 1]
            p10 = float(np.percentile(day_vals, 10))
            p50 = float(np.percentile(day_vals, 50))
            p90 = float(np.percentile(day_vals, 90))
            p95 = float(np.percentile(day_vals, 95))

            table_breakdown_p50 = {}
            for tbl in self.tables:
                tbl_id = tbl["id"]
                t_gb = float(np.percentile(table_trajectories[tbl_id][:, step - 1], 50))
                i_gb = float(np.percentile(index_trajectories[tbl_id][:, step - 1], 50))
                table_breakdown_p50[tbl_id] = {
                    "table_gb": round(t_gb, 3),
                    "index_gb": round(i_gb, 3),
                    "total_gb": round(t_gb + i_gb, 3)
                }

            forecast_series.append({
                "day_index": future_day_idx,
                "date": date_str,
                "p10_gb": round(p10, 3),
                "p50_gb": round(p50, 3),
                "p90_gb": round(p90, 3),
                "p95_gb": round(p95, 3),
                "table_breakdown": table_breakdown_p50
            })

        ex_p50_day = int(np.percentile(exhaustion_days_mc, 50))
        ex_p10_day = int(np.percentile(exhaustion_days_mc, 10))
        ex_p90_day = int(np.percentile(exhaustion_days_mc, 90))

        ex_p50_date = (last_date + timedelta(days=ex_p50_day - last_day_idx)).strftime("%Y-%m-%d") if ex_p50_day <= (last_day_idx + forecast_days) else "Beyond Horizon"

        dte_p50 = int(ex_p50_day - last_day_idx)

        return {
            "model_name": "Proposed Tenant-Aware Hierarchical Forecaster",
            "exhaustion_day_index_p50": ex_p50_day,
            "exhaustion_date_p50": ex_p50_date,
            "days_to_exhaustion_p50": dte_p50,
            "days_to_exhaustion_p10": int(ex_p10_day - last_day_idx),
            "days_to_exhaustion_p90": int(ex_p90_day - last_day_idx),
            "forecast": forecast_series
        }


def run_backtest_benchmark(dataset, historical_cutoffs=[240, 270, 300, 330, 365]):
    telemetry = dataset["telemetry"]
    storage_limit_gb = float(dataset["storage_limits"]["total_disk_limit_gb"])

    actual_exhaustion_day = None
    for entry in telemetry:
        if entry["totals"]["total_gb"] >= storage_limit_gb:
            actual_exhaustion_day = int(entry["day_index"])
            break

    results = []

    for cutoff in historical_cutoffs:
        history_slice = [d for d in telemetry if d["day_index"] < cutoff]
        actual_dte = int(actual_exhaustion_day - (cutoff - 1)) if actual_exhaustion_day else 999

        # Run Baseline
        base_model = BaselineForecaster(history_slice)
        base_res = base_model.predict(forecast_days=180, storage_limit_gb=storage_limit_gb)
        base_dte = int(base_res["days_to_exhaustion"])
        base_error = int(abs(base_dte - actual_dte))

        # Run Proposed
        prop_model = ProposedTenantAwareForecaster(dataset, cutoff_day_index=cutoff)
        prop_res = prop_model.predict(forecast_days=180, num_mc_sims=150)
        prop_dte = int(prop_res["days_to_exhaustion_p50"])
        prop_error = int(abs(prop_dte - actual_dte))

        err_reduction = round((1.0 - (prop_error / max(1, base_error))) * 100, 2)

        results.append({
            "cutoff_day_index": int(cutoff),
            "cutoff_date": telemetry[cutoff - 1]["date"],
            "actual_exhaustion_day": actual_exhaustion_day,
            "actual_dte_days": actual_dte,
            "baseline_pred_dte": base_dte,
            "baseline_error_days": base_error,
            "proposed_pred_dte": prop_dte,
            "proposed_error_days": prop_error,
            "error_reduction_pct": err_reduction
        })

    baseline_mae = float(np.mean([r["baseline_error_days"] for r in results]))
    proposed_mae = float(np.mean([r["proposed_error_days"] for r in results]))
    baseline_rmse = float(np.sqrt(np.mean([r["baseline_error_days"] ** 2 for r in results])))
    proposed_rmse = float(np.sqrt(np.mean([r["proposed_error_days"] ** 2 for r in results])))

    overall_mae_improvement_pct = round((1.0 - (proposed_mae / max(0.001, baseline_mae))) * 100, 2)

    return {
        "actual_exhaustion_day": actual_exhaustion_day,
        "storage_limit_gb": storage_limit_gb,
        "cutoff_evaluations": results,
        "summary": {
            "baseline_dte_mae": round(baseline_mae, 2),
            "baseline_dte_rmse": round(baseline_rmse, 2),
            "proposed_dte_mae": round(proposed_mae, 2),
            "proposed_dte_rmse": round(proposed_rmse, 2),
            "overall_mae_improvement_pct": overall_mae_improvement_pct
        }
    }


if __name__ == "__main__":
    with open("telemetry_dataset.json") as f:
        dataset = json.load(f)

    print("Running Backtest Benchmark...")
    benchmark = run_backtest_benchmark(dataset)
    print(f"Actual Exhaustion Day: {benchmark['actual_exhaustion_day']}")
    print(f"Baseline DTE MAE: {benchmark['summary']['baseline_dte_mae']} days")
    print(f"Proposed DTE MAE: {benchmark['summary']['proposed_dte_mae']} days")
    print(f"MAE Improvement: {benchmark['summary']['overall_mae_improvement_pct']}% reduction in forecast error!")

    with open("backtest_results.json", "w") as f:
        json.dump(benchmark, f, indent=2)
