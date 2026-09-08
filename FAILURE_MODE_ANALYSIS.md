# Failure-Mode & Risk Analysis: Tenant-Aware Storage Capacity Forecaster

This document provides a deep-dive analysis of five critical failure modes and edge cases where storage capacity predictions face potential risk or failure in public benefits database environments.

---

## Summary of Analyzed Failure Modes

| Case # | Failure Mode | Severity | Model Impact | Primary Engineering Mitigation |
|:---:|:---|:---:|:---|:---|
| **FM-1** | Unannounced Tenant Onboarding Surge | **HIGH** | Underestimates row growth by +45% | Event-driven instant model re-fitting API |
| **FM-2** | EOM Disbursement Schedule Shift | **MEDIUM** | Phase-lag misalignment of EOM cyclical features | State calendar holiday & disbursement schedule API |
| **FM-3** | Index Bloat Non-Linear Split Acceleration | **HIGH** | Sudden 3.5x GIN/B-Tree size jump | Index bloat factor alert + CONCURRENT REINDEX CR |
| **FM-4** | Retention Purge Cron Execution Failure | **HIGH** | Actual storage diverges upwards from decay curve | Purge heartbeat monitor linked to Audit Log |
| **FM-5** | Storage Quota & Disk Drift Miscalibration | **MEDIUM** | False positive capacity exhaustion alerts | Rolling 7-day disk quota drift auto-recalibration |

---

## Detailed Failure Mode Deep-Dives

### Failure Mode 1: Unannounced Tenant Onboarding Surge (FM-1)
- **Description**: A state agency (e.g. Pennsylvania Department of Human Services) onboards 300,000 new benefit recipients overnight without pre-registering the tenant in the capacity forecaster.
- **Symptom**: Ingestion rate spikes from 12,000 rows/day to 28,000 rows/day without historical precedent.
- **Model Failure Mechanism**: Historical tenant weights ($W_{tenant}$) undercount new workload. Baseline trend slope underestimates near-term storage consumption.
- **Quantitative Impact**: DTE predicted as 110 days, but actual capacity exhaustion occurs in 38 days.
- **Mitigation Strategy**: Implement an event-driven webhook (`ON_TENANT_REGISTER`) that triggers immediate re-fitting of tenant weight vectors and recalculates Monte Carlo quantile trajectories within 60 seconds.

---

### Failure Mode 2: EOM Disbursement Schedule Shift (FM-2)
- **Description**: State legislature modifies SNAP disbursement dates from the 28th of the month to the 15th due to state holiday scheduling.
- **Symptom**: Transaction volume surges on Day 15, while Day 28 remains quiet.
- **Model Failure Mechanism**: Day-of-Month (DOM) cyclical feature ($DOM \ge 25$) expects the surge late in the month, creating a phase lag error.
- **Quantitative Impact**: DTE forecast error increases by +18 days during the transition month.
- **Mitigation Strategy**: Ingest dynamic state disbursement calendar tables (`state_disbursement_schedule`) into the feature pipeline rather than relying on static $DOM \ge 25$ rules.

---

### Failure Mode 3: Index Bloat Non-Linear Split Acceleration (FM-3)
- **Description**: High row update churn on `benefit_claims` causes GIN metadata indexes to reach B-Tree page split depth thresholds, causing sudden page fragmentation and non-linear size jumps.
- **Symptom**: Index size jumps by 14 GB over 48 hours while raw table data only grows by 3 GB.
- **Model Failure Mechanism**: Linear index-to-data ratio model fails to capture sudden logarithmic B-Tree depth page splits.
- **Quantitative Impact**: Index tablespace capacity exhausted 40 days ahead of table data tablespace.
- **Mitigation Strategy**: Incorporate log-scale bloat factors ($Bloat = 1.0 + \gamma \log_{10}(ActiveRows) \cdot BloatFactor$) and automatically trigger an `INDEX_REBUILD_DEFRAG` Change Request when index-to-data ratio exceeds 1.35x.

---

### Failure Mode 4: Retention Purge Cron Execution Failure (FM-4)
- **Description**: The background partition drop job enforcing 90-day retention on `benefit_claims` fails silently due to exclusive table lock contention during peak hours.
- **Symptom**: Expired historical rows are not purged, causing cumulative rows to keep growing continuously.
- **Model Failure Mechanism**: The forecaster assumes retention sliding window subtraction ($Rows_{purged} = Rows(t - 90)$) occurred, causing predicted storage to diverge below actual disk usage.
- **Quantitative Impact**: Actual storage breaches capacity threshold 25 days earlier than predicted.
- **Mitigation Strategy**: Telemetry ingestion verifies actual database row count against expected retention window. If expected purge did not execute, the system emits an immediate `PURGE_FAILURE_ALERT` and flags the CR in the Governance UI.

---

### Failure Mode 5: Storage Quota & Disk Drift Miscalibration (FM-5)
- **Description**: Disk filesystem overhead, OS logging, or WAL segment retention increases background disk consumption outside of database tables.
- **Symptom**: Disk usage increases by 4 GB without corresponding row count growth in database tables.
- **Model Failure Mechanism**: Forecaster models database table & index bytes accurately, but misses external filesystem storage drift.
- **Quantitative Impact**: False optimistic prediction of disk exhaustion.
- **Mitigation Strategy**: Include an external OS disk drift telemetry metric ($GB_{untracked\_drift}$) in the total disk limit equation ($TotalGB = TableGB + IndexGB + DriftGB$).
