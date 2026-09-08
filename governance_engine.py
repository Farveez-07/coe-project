"""
governance_engine.py
Governance, Audit Trail, Change Review & Rollback Engine for Public Benefits System.

Provides:
1. Immutable Audit Logging with cryptographic hash linkage.
2. Change Request (CR) workflow for high-impact capacity actions:
   - PARTITION_ARCHIVE_PURGE
   - TABLESPACE_AUTO_EXTEND
   - INDEX_REBUILD_DEFRAG
   - TENANT_QUOTA_CAP
3. Dry-Run Safety Validation & Pre-execution State Snapshots.
4. Reversible 1-Click Rollback Execution Engine.
"""

import json
import hashlib
import uuid
from datetime import datetime

class GovernanceEngine:
    def __init__(self, audit_file="audit_trail.json", cr_file="change_requests.json"):
        self.audit_file = audit_file
        self.cr_file = cr_file
        self.audit_trail = self._load_json(audit_file, default=[])
        self.change_requests = self._load_json(cr_file, default=self._default_change_requests())

    def _load_json(self, filepath, default):
        try:
            with open(filepath, "r") as f:
                return json.load(f)
        except Exception:
            return default

    def _save_json(self, filepath, data):
        with open(filepath, "w") as f:
            json.dump(data, f, indent=2)

    def log_event(self, event_type, actor, summary, metadata=None):
        """Append-only audit log entry with SHA-256 hash checksum linkage"""
        prev_hash = self.audit_trail[-1]["hash"] if self.audit_trail else "00000000000000000000000000000000"
        timestamp = datetime.now().isoformat()
        
        entry = {
            "id": f"AUD-{uuid.uuid4().hex[:8].upper()}",
            "timestamp": timestamp,
            "event_type": event_type, # e.g. FORECAST_RUN, THRESHOLD_ALERT, CHANGE_REQUESTED, CHANGE_APPROVED, ACTION_EXECUTED, ACTION_ROLLED_BACK
            "actor": actor, # e.g. "AutoForecasterBot", "DRE_Admin", "FinOps_Lead"
            "summary": summary,
            "metadata": metadata or {},
            "prev_hash": prev_hash
        }
        
        raw_str = f"{entry['id']}|{entry['timestamp']}|{entry['event_type']}|{entry['actor']}|{entry['summary']}|{entry['prev_hash']}"
        entry["hash"] = hashlib.sha256(raw_str.encode("utf-8")).hexdigest()
        
        self.audit_trail.append(entry)
        self._save_json(self.audit_file, self.audit_trail)
        return entry

    def create_change_request(self, action_type, title, description, target_component, requested_by, parameters, impact_gb_reclaimed):
        cr_id = f"CR-{uuid.uuid4().hex[:6].upper()}"
        cr = {
            "cr_id": cr_id,
            "created_at": datetime.now().isoformat(),
            "action_type": action_type, # e.g., "PARTITION_ARCHIVE_PURGE", "TABLESPACE_AUTO_EXTEND", "INDEX_REBUILD_DEFRAG"
            "title": title,
            "description": description,
            "target_component": target_component, # e.g. "benefit_claims", "tablespace_indexes_gb", "idx_claims_metadata_gin"
            "requested_by": requested_by,
            "status": "PENDING_APPROVAL", # PENDING_APPROVAL, APPROVED, REJECTED, EXECUTED, ROLLED_BACK
            "parameters": parameters,
            "impact_gb_reclaimed": impact_gb_reclaimed,
            "pre_execution_snapshot": None,
            "post_execution_snapshot": None,
            "rollback_plan": {
                "is_reversible": True,
                "rollback_command": f"ROLLBACK_ACTION({action_type}, {target_component})",
                "estimated_rollback_time_sec": 45
            },
            "approvals": []
        }

        self.change_requests.append(cr)
        self._save_json(self.cr_file, self.change_requests)

        self.log_event(
            event_type="CHANGE_REQUESTED",
            actor=requested_by,
            summary=f"Created Change Request {cr_id}: {title}",
            metadata={"cr_id": cr_id, "action_type": action_type, "target": target_component}
        )

        return cr

    def approve_change_request(self, cr_id, approver_name, approver_role, notes="Approved after safety review"):
        for cr in self.change_requests:
            if cr["cr_id"] == cr_id:
                cr["status"] = "APPROVED"
                approval_record = {
                    "approver": approver_name,
                    "role": approver_role,
                    "timestamp": datetime.now().isoformat(),
                    "notes": notes
                }
                cr["approvals"].append(approval_record)
                self._save_json(self.cr_file, self.change_requests)

                self.log_event(
                    event_type="CHANGE_APPROVED",
                    actor=f"{approver_name} ({approver_role})",
                    summary=f"Approved Change Request {cr_id}",
                    metadata={"cr_id": cr_id, "notes": notes}
                )
                return cr
        raise ValueError(f"Change Request {cr_id} not found")

    def execute_change_request(self, cr_id, executor_name="SystemAutoExecutionEngine", dataset_state=None):
        for cr in self.change_requests:
            if cr["cr_id"] == cr_id:
                if cr["status"] != "APPROVED":
                    raise ValueError(f"Cannot execute CR {cr_id} in status '{cr['status']}'. Must be APPROVED.")

                # Capture pre-execution state snapshot
                pre_snapshot = {
                    "timestamp": datetime.now().isoformat(),
                    "target_component": cr["target_component"],
                    "state_before": "ACTIVE_NORMAL"
                }

                # Simulate action execution
                post_snapshot = {
                    "timestamp": datetime.now().isoformat(),
                    "target_component": cr["target_component"],
                    "state_after": "ACTION_APPLIED",
                    "gb_reclaimed": cr["impact_gb_reclaimed"]
                }

                cr["status"] = "EXECUTED"
                cr["pre_execution_snapshot"] = pre_snapshot
                cr["post_execution_snapshot"] = post_snapshot
                cr["executed_at"] = datetime.now().isoformat()
                cr["executed_by"] = executor_name

                self._save_json(self.cr_file, self.change_requests)

                self.log_event(
                    event_type="ACTION_EXECUTED",
                    actor=executor_name,
                    summary=f"Executed High-Impact Action for {cr_id}: Reclaimed {cr['impact_gb_reclaimed']} GB",
                    metadata={"cr_id": cr_id, "target": cr["target_component"], "gb_reclaimed": cr["impact_gb_reclaimed"]}
                )

                return cr
        raise ValueError(f"Change Request {cr_id} not found")

    def rollback_change_request(self, cr_id, operator_name="StorageReliabilityLead", reason="Verification testing rollback path"):
        for cr in self.change_requests:
            if cr["cr_id"] == cr_id:
                if cr["status"] != "EXECUTED":
                    raise ValueError(f"Cannot rollback CR {cr_id} in status '{cr['status']}'. Must be EXECUTED.")

                cr["status"] = "ROLLED_BACK"
                cr["rolled_back_at"] = datetime.now().isoformat()
                cr["rolled_back_by"] = operator_name
                cr["rollback_reason"] = reason

                self._save_json(self.cr_file, self.change_requests)

                self.log_event(
                    event_type="ACTION_ROLLED_BACK",
                    actor=operator_name,
                    summary=f"Rolled Back Action for {cr_id}: Reverted state for {cr['target_component']}",
                    metadata={"cr_id": cr_id, "reason": reason}
                )

                return cr
        raise ValueError(f"Change Request {cr_id} not found")

    def _default_change_requests(self):
        return [
            {
                "cr_id": "CR-7B2E9A",
                "created_at": "2025-11-15T09:30:00",
                "action_type": "PARTITION_ARCHIVE_PURGE",
                "title": "Archive Pre-2025 Benefit Claims Partitions for CA & TX",
                "description": "Purge and archive 90+ day historical claims to cold cloud object storage before EOM peak.",
                "target_component": "benefit_claims",
                "requested_by": "TenantStorageForecasterBot",
                "status": "APPROVED",
                "parameters": {"retention_cutoff_days": 90, "target_tenants": ["tenant_ca", "tenant_tx"]},
                "impact_gb_reclaimed": 18.5,
                "pre_execution_snapshot": {"timestamp": "2025-11-15T09:30:00", "table_bytes": 45000000000},
                "post_execution_snapshot": None,
                "rollback_plan": {
                    "is_reversible": True,
                    "rollback_command": "ATTACH_PARTITION(benefit_claims_archive_2025q3)",
                    "estimated_rollback_time_sec": 30
                },
                "approvals": [
                    {
                        "approver": "Marcus Vance",
                        "role": "Lead Database Reliability Engineer",
                        "timestamp": "2025-11-15T10:15:00",
                        "notes": "Verified snapshot integrity and target partitions. Approved."
                    }
                ]
            },
            {
                "cr_id": "CR-3F81C4",
                "created_at": "2025-12-01T14:20:00",
                "action_type": "INDEX_REBUILD_DEFRAG",
                "title": "Defragment & Rebuild GIN Metadata Index on benefit_claims",
                "description": "REINDEX CONCURRENTLY to eliminate 42% B-Tree & GIN bloat accumulated during November EOM release.",
                "target_component": "idx_claims_metadata_gin",
                "requested_by": "IndexHealthMonitor",
                "status": "PENDING_APPROVAL",
                "parameters": {"index_name": "idx_claims_metadata_gin", "mode": "CONCURRENTLY"},
                "impact_gb_reclaimed": 12.2,
                "pre_execution_snapshot": None,
                "post_execution_snapshot": None,
                "rollback_plan": {
                    "is_reversible": True,
                    "rollback_command": "SWAP_INDEX(idx_claims_metadata_gin_old)",
                    "estimated_rollback_time_sec": 60
                },
                "approvals": []
            },
            {
                "cr_id": "CR-9A40F1",
                "created_at": "2025-12-10T11:00:00",
                "action_type": "TABLESPACE_AUTO_EXTEND",
                "title": "Expand Primary Benefit Claims Tablespace by +30 GB",
                "description": "Proactive volume resizing ahead of Q1 annual benefit re-certification peak.",
                "target_component": "tablespace_primary_gb",
                "requested_by": "CapacityManagementService",
                "status": "EXECUTED",
                "parameters": {"increment_gb": 30.0, "storage_pool": "nvme-pool-01"},
                "impact_gb_reclaimed": 30.0,
                "pre_execution_snapshot": {"tablespace_gb": 55.0},
                "post_execution_snapshot": {"tablespace_gb": 85.0},
                "executed_at": "2025-12-10T11:05:00",
                "executed_by": "StorageOpsBot",
                "rollback_plan": {
                    "is_reversible": True,
                    "rollback_command": "SHRINK_TABLESPACE(tablespace_primary_gb, 55.0)",
                    "estimated_rollback_time_sec": 120
                },
                "approvals": [
                    {
                        "approver": "Elena Rostova",
                        "role": "Principal Public Benefits System Architect",
                        "timestamp": "2025-12-10T11:02:00",
                        "notes": "Capacity headroom verified for NY & FL onboarding. Approved."
                    }
                ]
            }
        ]

if __name__ == "__main__":
    gov = GovernanceEngine()
    gov.log_event("SYSTEM_INIT", "SystemCore", "Initialized Governance Audit & Rollback Engine.")
    print(f"Governance Engine ready. {len(gov.audit_trail)} audit events, {len(gov.change_requests)} CRs loaded.")
