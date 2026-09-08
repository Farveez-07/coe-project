"""
data_generator.py
Synthetic Telemetry Generator for Tenant-Aware Public Benefits Storage Capacity Forecaster.

Generates 365 days of historical telemetry + 180 days of ground truth future telemetry for a 
multi-tenant public benefits processing system (SNAP, TANF, Medicaid, Childcare).
Includes:
- Tenant-level activity breakdown with multi-tenant skew
- End-Of-Month (EOM) disbursement transaction peaks (25th to 31st of each month)
- Table-level row growth & byte size metrics
- Index-level size metrics with non-linear B-Tree / GIN bloat factors
- Retention rules execution (e.g., 90-day claims history, 30-day transient logs)
- Table, Index, Tablespace, and Disk Storage limit quotas
"""

import json
import math
import random
from datetime import datetime, timedelta

def generate_telemetry_data(history_days=365, future_days=180, seed=42):
    random.seed(seed)
    start_date = datetime(2025, 1, 1)

    tenants = [
        {"id": "tenant_ca", "name": "CA Dept of Social Services", "base_weight": 0.35, "growth_rate": 0.0030},
        {"id": "tenant_ny", "name": "NY Medicaid Assistance", "base_weight": 0.25, "growth_rate": 0.0025},
        {"id": "tenant_tx", "name": "TX SNAP Disbursement", "base_weight": 0.20, "growth_rate": 0.0035},
        {"id": "tenant_fl", "name": "FL TANF Benefits Office", "base_weight": 0.12, "growth_rate": 0.0020},
        {"id": "tenant_il", "name": "IL Childcare Program", "base_weight": 0.08, "growth_rate": 0.0015},
    ]

    tables = [
        {
            "id": "benefit_claims",
            "name": "benefit_claims",
            "avg_row_bytes": 780,
            "retention_days": 90,
            "indexes": [
                {"id": "idx_claims_pk", "name": "benefit_claims_pkey", "type": "btree", "base_ratio": 0.30, "bloat_factor": 1.20},
                {"id": "idx_claims_tenant_date", "name": "idx_claims_tenant_disbursement_date", "type": "btree", "base_ratio": 0.40, "bloat_factor": 1.35},
                {"id": "idx_claims_payload_gin", "name": "idx_claims_metadata_gin", "type": "gin", "base_ratio": 0.75, "bloat_factor": 1.95}
            ]
        },
        {
            "id": "recipient_eligibility",
            "name": "recipient_eligibility",
            "avg_row_bytes": 1450,
            "retention_days": 365,
            "indexes": [
                {"id": "idx_elig_pk", "name": "recipient_eligibility_pkey", "type": "btree", "base_ratio": 0.25, "bloat_factor": 1.15},
                {"id": "idx_elig_ssn_tenant", "name": "idx_elig_tenant_ssn", "type": "btree", "base_ratio": 0.35, "bloat_factor": 1.25}
            ]
        },
        {
            "id": "payment_disbursements",
            "name": "payment_disbursements",
            "avg_row_bytes": 620,
            "retention_days": 180,
            "indexes": [
                {"id": "idx_pay_pk", "name": "payment_disbursements_pkey", "type": "btree", "base_ratio": 0.28, "bloat_factor": 1.18},
                {"id": "idx_pay_status_date", "name": "idx_pay_status_date", "type": "btree", "base_ratio": 0.38, "bloat_factor": 1.32}
            ]
        },
        {
            "id": "audit_events",
            "name": "audit_events",
            "avg_row_bytes": 1100,
            "retention_days": 0,
            "indexes": [
                {"id": "idx_audit_pk", "name": "audit_events_pkey", "type": "btree", "base_ratio": 0.20, "bloat_factor": 1.10},
                {"id": "idx_audit_ts", "name": "idx_audit_timestamp", "type": "btree", "base_ratio": 0.30, "bloat_factor": 1.25}
            ]
        },
        {
            "id": "document_verifications",
            "name": "document_verifications",
            "avg_row_bytes": 3200,
            "retention_days": 60,
            "indexes": [
                {"id": "idx_doc_pk", "name": "document_verifications_pkey", "type": "btree", "base_ratio": 0.18, "bloat_factor": 1.18},
                {"id": "idx_doc_doc_id", "name": "idx_doc_doc_id", "type": "btree", "base_ratio": 0.28, "bloat_factor": 1.28}
            ]
        }
    ]

    # Disk limit set to 96.0 GB so exhaustion occurs during EOM peak around day 395
    storage_limits = {
        "tablespace_primary_gb": 55.0,
        "tablespace_indexes_gb": 45.0,
        "total_disk_limit_gb": 96.0,
        "warn_threshold_pct": 80.0,
        "critical_threshold_pct": 90.0
    }

    daily_records = []
    table_tenant_history = {t["id"]: {tn["id"]: [] for tn in tenants} for t in tables}
    total_days = history_days + future_days

    for day_idx in range(total_days):
        current_date = start_date + timedelta(days=day_idx)
        date_str = current_date.strftime("%Y-%m-%d")
        day_of_month = current_date.day
        is_eom_peak = day_of_month >= 25 or day_of_month <= 3
        eom_multiplier = (5.2 + random.uniform(-0.4, 0.8)) if is_eom_peak else (1.0 + random.uniform(-0.05, 0.10))
        
        if 14 <= day_of_month <= 16:
            eom_multiplier *= 1.8

        is_future = day_idx >= history_days

        daily_entry = {
            "day_index": day_idx,
            "date": date_str,
            "is_future": is_future,
            "is_eom_peak": is_eom_peak,
            "eom_multiplier": round(eom_multiplier, 3),
            "tables": {},
            "totals": {
                "table_bytes": 0,
                "index_bytes": 0,
                "total_bytes": 0,
                "table_gb": 0.0,
                "index_gb": 0.0,
                "total_gb": 0.0
            }
        }

        for tbl in tables:
            tbl_id = tbl["id"]
            avg_row_bytes = tbl["avg_row_bytes"]
            retention_days = tbl["retention_days"]

            tbl_tenant_data = {}
            tbl_new_rows_total = 0
            tbl_purged_rows_total = 0

            for tenant in tenants:
                tn_id = tenant["id"]
                base_w = tenant["base_weight"]
                g_rate = tenant["growth_rate"]

                base_daily_rows = int((4500 + day_idx * 12) * base_w * (1.0 + g_rate * day_idx))
                tenant_eom_sens = 1.30 if tn_id in ["tenant_ca", "tenant_tx"] else 1.0
                daily_new_rows = int(base_daily_rows * (1.0 + (eom_multiplier - 1.0) * tenant_eom_sens))
                daily_new_rows = max(100, int(daily_new_rows * random.uniform(0.95, 1.05)))

                table_tenant_history[tbl_id][tn_id].append(daily_new_rows)

                purged_rows = 0
                if retention_days > 0 and len(table_tenant_history[tbl_id][tn_id]) > retention_days:
                    purged_rows = table_tenant_history[tbl_id][tn_id][-retention_days - 1]

                tbl_new_rows_total += daily_new_rows
                tbl_purged_rows_total += purged_rows

                active_rows_tenant = sum(table_tenant_history[tbl_id][tn_id][-retention_days:]) if retention_days > 0 else sum(table_tenant_history[tbl_id][tn_id])
                
                tbl_tenant_data[tn_id] = {
                    "new_rows": daily_new_rows,
                    "purged_rows": purged_rows,
                    "active_rows": active_rows_tenant,
                    "tenant_bytes": active_rows_tenant * avg_row_bytes
                }

            total_active_rows = sum(d["active_rows"] for d in tbl_tenant_data.values())
            tbl_data_bytes = total_active_rows * avg_row_bytes

            tbl_index_bytes = 0
            index_metrics = []
            for idx in tbl["indexes"]:
                idx_base = tbl_data_bytes * idx["base_ratio"]
                bloat = 1.0 + (math.log10(max(100, total_active_rows)) * 0.05) * idx["bloat_factor"]
                idx_size = int(idx_base * bloat)
                tbl_index_bytes += idx_size
                index_metrics.append({
                    "id": idx["id"],
                    "name": idx["name"],
                    "type": idx["type"],
                    "size_bytes": idx_size,
                    "size_mb": round(idx_size / (1024 * 1024), 2)
                })

            tbl_total_bytes = tbl_data_bytes + tbl_index_bytes

            daily_entry["tables"][tbl_id] = {
                "name": tbl["name"],
                "active_rows": total_active_rows,
                "new_rows_today": tbl_new_rows_total,
                "purged_rows_today": tbl_purged_rows_total,
                "data_bytes": tbl_data_bytes,
                "data_mb": round(tbl_data_bytes / (1024 * 1024), 2),
                "index_bytes": tbl_index_bytes,
                "index_mb": round(tbl_index_bytes / (1024 * 1024), 2),
                "total_bytes": tbl_total_bytes,
                "total_mb": round(tbl_total_bytes / (1024 * 1024), 2),
                "indexes": index_metrics,
                "tenant_breakdown": tbl_tenant_data
            }

            daily_entry["totals"]["table_bytes"] += tbl_data_bytes
            daily_entry["totals"]["index_bytes"] += tbl_index_bytes

        daily_entry["totals"]["total_bytes"] = daily_entry["totals"]["table_bytes"] + daily_entry["totals"]["index_bytes"]
        daily_entry["totals"]["table_gb"] = round(daily_entry["totals"]["table_bytes"] / (1024 ** 3), 3)
        daily_entry["totals"]["index_gb"] = round(daily_entry["totals"]["index_bytes"] / (1024 ** 3), 3)
        daily_entry["totals"]["total_gb"] = round(daily_entry["totals"]["total_bytes"] / (1024 ** 3), 3)

        daily_records.append(daily_entry)

    return {
        "tenants": tenants,
        "tables": tables,
        "storage_limits": storage_limits,
        "history_days": history_days,
        "future_days": future_days,
        "telemetry": daily_records
    }

if __name__ == "__main__":
    dataset = generate_telemetry_data()
    with open("telemetry_dataset.json", "w") as f:
        json.dump(dataset, f, indent=2)
    print(f"Generated {len(dataset['telemetry'])} days of telemetry data into telemetry_dataset.json.")
