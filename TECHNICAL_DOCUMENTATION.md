# Technical Documentation: Tenant-Aware Storage Capacity Forecaster

This technical manual details the mathematical models, database schemas, forecasting algorithms, REST API specifications, and governance mechanics of the Tenant-Aware Storage Capacity Forecaster.

---

## 1. System Architecture & Component Design

```
+-----------------------------------------------------------------------------------+
|                           PROPOSED FORECASTING ENGINE                             |
|                                                                                   |
|  +--------------------+     +---------------------+     +----------------------+  |
|  |  Tenant Activity   |     |  EOM Disbursement   |     |  Index Amplification |  |
|  |  Decomposition     |  +  |  Cyclical Features  |  +  |  & Bloat Model       |  |
|  |  (CA, NY, TX...)   |     |  (DOM >= 25 Spikes) |     |  (GIN & B-Tree)      |  |
|  +---------+----------+     +----------+----------+     +----------+-----------+  |
|            |                           |                           |              |
|            +---------------------------+---------------------------+              |
|                                        |                                          |
|                                        v                                          |
|                  +-------------------------------------------+                    |
|                  | Retention Window Purge Simulation Engine  |                    |
|                  | (90d Claims / 60d Docs / Permanent Audit) |                    |
|                  +---------------------+---------------------+                    |
|                                        |                                          |
|                                        v                                          |
|                  +-------------------------------------------+                    |
|                  | 150-Trajectory Monte Carlo Simulator      |                    |
|                  | (Generates P10, P50, P90, P95 Quantiles)  |                    |
|                  +---------------------+---------------------+                    |
|                                        |                                          |
|                                        v                                          |
|                  +-------------------------------------------+                    |
|                  | Days-To-Exhaustion (DTE) Breach Predictor  |                    |
|                  +-------------------------------------------+                    |
+-----------------------------------------------------------------------------------+
```

---

## 2. Mathematical Formulation & Modeling Equations

### 2.1 Tenant-Decomposed Daily Row Ingestion Rate
For table $j$ and tenant $i$ on future day $t$, daily row generation $R_{new}(i, j, t)$ is formulated as:

$$R_{new}(i, j, t) = \max\left(50, \left\lfloor \left( R_{base}(i, j) + S_{trend}(i, j) \cdot t \right) \cdot M_{EOM}(t) \cdot \epsilon_t \right\rfloor\right)$$

Where:
- $R_{base}(i, j)$: Recent baseline daily row ingestion rate for tenant $i$ on table $j$.
- $S_{trend}(i, j)$: Linear growth trend slope derived via Ordinary Least Squares on past 60 days.
- $M_{EOM}(t)$: Cyclical End-Of-Month multiplier:
  $$M_{EOM}(t) = \begin{cases} M_{peak} \cdot (1 + \sigma_{peak}), & \text{if } DOM(t) \ge 25 \text{ or } DOM(t) \le 3 \\ 1.8 \cdot (1 + \sigma_{mid}), & \text{if } 14 \le DOM(t) \le 16 \\ 1.0 \cdot (1 + \sigma_{norm}), & \text{otherwise} \end{cases}$$
- $\epsilon_t \sim \mathcal{N}(1.0, \sigma^2)$: Gaussian white noise term modeling daily transaction volatility.

---

### 2.2 Retention Window Purge Simulation
Active rows $Rows_{active}(j, t)$ for table $j$ with retention window $W_j$ (days):

$$Rows_{active}(j, t) = \begin{cases} \sum_{i} \sum_{\tau = t - W_j + 1}^{t} R_{new}(i, j, \tau), & \text{if } W_j > 0 \\ \sum_{i} \sum_{\tau = 1}^{t} R_{new}(i, j, \tau), & \text{if } W_j = 0 \text{ (Permanent Table)} \end{cases}$$

Raw table data size in bytes $Bytes_{data}(j, t)$:

$$Bytes_{data}(j, t) = Rows_{active}(j, t) \cdot Bytes_{avg\_row}(j)$$

---

### 2.3 Index Amplification & Bloat Equation
Index size $Bytes_{index}(k, j, t)$ for index $k$ on table $j$ accounts for base index ratio $\beta_k$ and non-linear B-Tree / GIN bloat inflation $\gamma_k$:

$$Bloat(k, j, t) = 1.0 + \left( \log_{10}\left( \max(100, Rows_{active}(j, t)) \right) \cdot 0.05 \right) \cdot \gamma_k$$

$$Bytes_{index}(k, j, t) = \left\lfloor Bytes_{data}(j, t) \cdot \beta_k \cdot Bloat(k, j, t) \right\rfloor$$

Total storage footprint $TotalGB(t)$:

$$TotalGB(t) = \frac{\sum_{j} \left( Bytes_{data}(j, t) + \sum_{k} Bytes_{index}(k, j, t) \right)}{1024^3}$$

---

## 3. Database Schema Definitions

### 3.1 Telemetry Event Schema (`telemetry_records`)
```sql
CREATE TABLE telemetry_records (
    day_index INT PRIMARY KEY,
    record_date DATE NOT NULL,
    is_eom_peak BOOLEAN NOT NULL,
    eom_multiplier NUMERIC(4, 2) NOT NULL,
    table_bytes BIGINT NOT NULL,
    index_bytes BIGINT NOT NULL,
    total_bytes BIGINT NOT NULL,
    total_gb NUMERIC(8, 3) NOT NULL,
    payload_json JSONB NOT NULL
);

CREATE INDEX idx_telemetry_date ON telemetry_records (record_date);
CREATE INDEX idx_telemetry_json_gin ON telemetry_records USING GIN (payload_json);
```

### 3.2 Governance Audit Log Schema (`audit_trail`)
```sql
CREATE TABLE audit_trail (
    event_id VARCHAR(32) PRIMARY KEY,
    event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    event_type VARCHAR(64) NOT NULL,
    actor VARCHAR(128) NOT NULL,
    summary TEXT NOT NULL,
    metadata JSONB,
    prev_hash CHAR(64) NOT NULL,
    hash CHAR(64) NOT NULL
);
```

---

## 4. REST API Endpoint Specification

### `GET /api/forecast`
- **Query Params**: `cutoff` (int, default 365), `forecast_days` (int, default 180).
- **Response**:
```json
{
  "cutoff_day_index": 365,
  "storage_limits": { "total_disk_limit_gb": 125.0 },
  "baseline_model": {
    "model_name": "Baseline Aggregate OLS Linear",
    "days_to_exhaustion": 142,
    "exhaustion_date": "2026-05-22"
  },
  "proposed_model": {
    "model_name": "Proposed Tenant-Aware Hierarchical Forecaster",
    "days_to_exhaustion_p50": 111,
    "days_to_exhaustion_p10": 94,
    "days_to_exhaustion_p90": 128,
    "exhaustion_date_p50": "2026-04-21"
  }
}
```

### `POST /api/governance/cr/approve`
- **Request Body**: `{ "cr_id": "CR-7B2E9A", "approver": "Marcus Vance", "role": "Lead DRE" }`
- **Response**: `{ "success": true, "change_request": { "status": "APPROVED" } }`

---

## 5. Verification & Testing Instructions

To run automated unit tests and backtesting benchmarks locally:

```bash
# 1. Activate virtual environment
source venv/bin/activate

# 2. Run data generator
python3 data_generator.py

# 3. Run forecasting engine & backtest benchmark
python3 forecaster_engine.py

# 4. Run experiment analysis suite
python3 experiment_analysis.py

# 5. Launch REST backend server
python3 server.py &

# 6. Launch Vite web dashboard UI
npm run dev
```
