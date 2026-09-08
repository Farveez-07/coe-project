"""
server.py
REST API Server for Tenant-Aware Storage Capacity Forecaster.

Built with Python standard library http.server for zero external dependencies and fast response times.
Exposes API endpoints for:
- Telemetry dataset
- Real-time Baseline vs Proposed Forecast predictions & Quantiles
- Rolling Backtest benchmark evaluations
- Governance Audit Trail & Change Management workflow (Approve, Execute, Rollback)
- What-If Scenario Simulation
"""

import json
import urllib.parse
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from data_generator import generate_telemetry_data
from forecaster_engine import BaselineForecaster, ProposedTenantAwareForecaster, run_backtest_benchmark
from governance_engine import GovernanceEngine

DATASET = None
GOVERNANCE = GovernanceEngine()

def get_or_create_dataset():
    global DATASET
    if DATASET is None:
        try:
            with open("telemetry_dataset.json", "r") as f:
                DATASET = json.load(f)
        except Exception:
            DATASET = generate_telemetry_data()
            with open("telemetry_dataset.json", "w") as f:
                json.dump(DATASET, f, indent=2)
    return DATASET

class CapacityForecasterRequestHandler(BaseHTTPRequestHandler):

    def _set_headers(self, status=200, content_type="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(200)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path
        query = urllib.parse.parse_qs(parsed.query)

        dataset = get_or_create_dataset()

        if path == "/" or path == "":
            self._set_headers(200)
            self.wfile.write(json.dumps({
                "status": "running",
                "message": "Tenant-Aware Storage Capacity Forecaster REST API Server is running.",
                "frontend_ui": "http://localhost:3000",
                "available_endpoints": [
                    "/api/health",
                    "/api/telemetry",
                    "/api/forecast",
                    "/api/backtest",
                    "/api/governance/audit",
                    "/api/governance/cr"
                ]
            }, indent=2).encode("utf-8"))

        elif path == "/api/health":
            self._set_headers(200)
            self.wfile.write(json.dumps({"status": "healthy", "system": "Tenant-Aware Storage Forecaster"}).encode("utf-8"))

        elif path == "/api/telemetry":
            self._set_headers(200)
            self.wfile.write(json.dumps(dataset).encode("utf-8"))

        elif path == "/api/forecast":
            cutoff = int(query.get("cutoff", [365])[0])
            forecast_days = int(query.get("forecast_days", [180])[0])

            history_slice = [d for d in dataset["telemetry"] if d["day_index"] < cutoff]
            base_model = BaselineForecaster(history_slice)
            base_res = base_model.predict(forecast_days=forecast_days, storage_limit_gb=dataset["storage_limits"]["total_disk_limit_gb"])

            prop_model = ProposedTenantAwareForecaster(dataset, cutoff_day_index=cutoff)
            prop_res = prop_model.predict(forecast_days=forecast_days, num_mc_sims=150)

            resp = {
                "cutoff_day_index": cutoff,
                "cutoff_date": dataset["telemetry"][cutoff - 1]["date"] if cutoff <= len(dataset["telemetry"]) else "N/A",
                "storage_limits": dataset["storage_limits"],
                "baseline_model": base_res,
                "proposed_model": prop_res
            }
            self._set_headers(200)
            self.wfile.write(json.dumps(resp).encode("utf-8"))

        elif path == "/api/backtest":
            try:
                with open("backtest_results.json", "r") as f:
                    bench = json.load(f)
            except Exception:
                bench = run_backtest_benchmark(dataset)
            self._set_headers(200)
            self.wfile.write(json.dumps(bench).encode("utf-8"))

        elif path == "/api/governance/audit":
            self._set_headers(200)
            self.wfile.write(json.dumps({"audit_trail": GOVERNANCE.audit_trail}).encode("utf-8"))

        elif path == "/api/governance/cr":
            self._set_headers(200)
            self.wfile.write(json.dumps({"change_requests": GOVERNANCE.change_requests}).encode("utf-8"))

        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": f"Endpoint '{path}' not found"}).encode("utf-8"))

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        content_length = int(self.headers.get("Content-Length", 0))
        body_bytes = self.rfile.read(content_length) if content_length > 0 else b"{}"
        body = json.loads(body_bytes.decode("utf-8"))

        dataset = get_or_create_dataset()

        if path == "/api/governance/cr/approve":
            cr_id = body.get("cr_id")
            approver = body.get("approver", "DRE_Admin")
            role = body.get("role", "Lead Database Reliability Engineer")
            notes = body.get("notes", "Approved via Dashboard")
            try:
                updated_cr = GOVERNANCE.approve_change_request(cr_id, approver, role, notes)
                self._set_headers(200)
                self.wfile.write(json.dumps({"success": True, "change_request": updated_cr}).encode("utf-8"))
            except Exception as e:
                self._set_headers(400)
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))

        elif path == "/api/governance/cr/execute":
            cr_id = body.get("cr_id")
            executor = body.get("executor", "SystemAutoExecutionEngine")
            try:
                updated_cr = GOVERNANCE.execute_change_request(cr_id, executor)
                self._set_headers(200)
                self.wfile.write(json.dumps({"success": True, "change_request": updated_cr}).encode("utf-8"))
            except Exception as e:
                self._set_headers(400)
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))

        elif path == "/api/governance/cr/rollback":
            cr_id = body.get("cr_id")
            operator = body.get("operator", "StorageReliabilityLead")
            reason = body.get("reason", "Operator initiated rollback from Dashboard UI")
            try:
                updated_cr = GOVERNANCE.rollback_change_request(cr_id, operator, reason)
                self._set_headers(200)
                self.wfile.write(json.dumps({"success": True, "change_request": updated_cr}).encode("utf-8"))
            except Exception as e:
                self._set_headers(400)
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode("utf-8"))

        elif path == "/api/scenario/simulate":
            # What-if scenario parameters
            eom_scale = float(body.get("eom_multiplier_scale", 1.0))
            new_tenant_weight = float(body.get("new_tenant_weight", 0.0))
            modified_retention_days = body.get("modified_retention_days", {}) # e.g. {"benefit_claims": 60}

            # Create temporary dataset clone
            sim_dataset = json.loads(json.dumps(dataset))
            
            # Apply retention modifications
            for tbl in sim_dataset["tables"]:
                if tbl["id"] in modified_retention_days:
                    tbl["retention_days"] = int(modified_retention_days[tbl["id"]])

            # Apply tenant addition if requested
            if new_tenant_weight > 0:
                sim_dataset["tenants"].append({
                    "id": "tenant_new_onboard",
                    "name": "Simulated State Onboarding (PA/OH)",
                    "base_weight": new_tenant_weight,
                    "growth_rate": 0.0040
                })

            prop_model = ProposedTenantAwareForecaster(sim_dataset, cutoff_day_index=365)
            forecast_res = prop_model.predict(forecast_days=180, num_mc_sims=100)

            self._set_headers(200)
            self.wfile.write(json.dumps({
                "scenario_parameters": {
                    "eom_scale": eom_scale,
                    "new_tenant_weight": new_tenant_weight,
                    "modified_retention_days": modified_retention_days
                },
                "simulated_forecast": forecast_res
            }).encode("utf-8"))

        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": f"POST endpoint '{path}' not found"}).encode("utf-8"))

def run_server(port=8080):
    get_or_create_dataset()
    server_address = ("", port)
    httpd = ThreadingHTTPServer(server_address, CapacityForecasterRequestHandler)
    print(f"Capacity Forecaster REST Server running on http://localhost:{port}")
    httpd.serve_forever()

if __name__ == "__main__":
    run_server(8080)
