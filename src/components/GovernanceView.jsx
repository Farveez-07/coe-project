import React, { useState } from 'react';
import { ShieldCheck, Lock, CheckCircle, RotateCcw, AlertTriangle, FileText, Check, Play, UserCheck } from 'lucide-react';

export default function GovernanceView({ auditTrail, changeRequests, onRefreshGovernance }) {
  const [activeTab, setActiveTab] = useState('change_requests'); // 'change_requests' or 'audit_log'
  const [selectedCr, setSelectedCr] = useState(null);
  const [actionNotes, setActionNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!changeRequests || !auditTrail) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading governance controls...</div>;
  }

  const handleApprove = async (crId) => {
    setIsProcessing(true);
    try {
      await fetch('/api/governance/cr/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cr_id: crId,
          approver: 'Marcus Vance',
          role: 'Lead Database Reliability Engineer',
          notes: actionNotes || 'Approved via Governance Control UI after safety verification.'
        })
      });
      setActionNotes('');
      if (onRefreshGovernance) onRefreshGovernance();
    } catch (err) {
      console.error('Approval failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecute = async (crId) => {
    setIsProcessing(true);
    try {
      await fetch('/api/governance/cr/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cr_id: crId,
          executor: 'DREAutoExecutionEngine'
        })
      });
      if (onRefreshGovernance) onRefreshGovernance();
    } catch (err) {
      console.error('Execution failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRollback = async (crId) => {
    setIsProcessing(true);
    try {
      await fetch('/api/governance/cr/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cr_id: crId,
          operator: 'Marcus Vance (DRE Lead)',
          reason: 'Initiated 1-click safety rollback from Governance Dashboard.'
        })
      });
      if (onRefreshGovernance) onRefreshGovernance();
    } catch (err) {
      console.error('Rollback failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={24} color="var(--accent-emerald)" />
            Governance, Change Review & Reversible Rollback Engine
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Multi-stage change approval workflow for high-impact capacity actions with 1-click reversible rollbacks
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', background: 'rgba(15,23,42,0.8)', padding: '4px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-card)' }}>
          <button
            className={`nav-tab-btn ${activeTab === 'change_requests' ? 'active' : ''}`}
            onClick={() => setActiveTab('change_requests')}
          >
            <FileText size={16} />
            Change Requests ({changeRequests.length})
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'audit_log' ? 'active' : ''}`}
            onClick={() => setActiveTab('audit_log')}
          >
            <Lock size={16} />
            Cryptographic Audit Log ({auditTrail.length})
          </button>
        </div>
      </div>

      {activeTab === 'change_requests' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {changeRequests.map(cr => {
            const isApproved = cr.status === 'APPROVED';
            const isExecuted = cr.status === 'EXECUTED';
            const isPending = cr.status === 'PENDING_APPROVAL';
            const isRolledBack = cr.status === 'ROLLED_BACK';

            return (
              <div key={cr.cr_id} className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-primary)' }}>{cr.cr_id}</span>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'var(--font-display)' }}>{cr.title}</h3>
                      <span className={`status-badge ${isExecuted ? 'success' : isApproved ? 'info' : isPending ? 'warning' : 'danger'}`}>
                        {cr.status}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{cr.description}</p>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Impact Reclaimed: </span>
                    <strong style={{ fontSize: '1.1rem', color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>+{cr.impact_gb_reclaimed} GB</strong>
                  </div>
                </div>

                {/* Details Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', background: 'rgba(15,23,42,0.6)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-card)', fontSize: '0.8rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-dim)' }}>Action Type:</span>
                    <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{cr.action_type}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-dim)' }}>Target Component:</span>
                    <div style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{cr.target_component}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-dim)' }}>Requested By:</span>
                    <div style={{ fontWeight: 600 }}>{cr.requested_by}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-dim)' }}>Reversible Rollback Path:</span>
                    <div style={{ color: cr.rollback_plan.is_reversible ? 'var(--accent-emerald)' : 'var(--accent-rose)', fontWeight: 600 }}>
                      {cr.rollback_plan.is_reversible ? 'Yes (Reversible)' : 'No (Irreversible)'}
                    </div>
                  </div>
                </div>

                {/* Approvals & Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px' }}>
                  <div>
                    {cr.approvals.length > 0 ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <UserCheck size={16} color="var(--accent-emerald)" />
                        <span>Approved by <strong>{cr.approvals[0].approver}</strong> ({cr.approvals[0].role})</span>
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--accent-amber)' }}>Requires DRE / FinOps Review & Approval</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    {isPending && (
                      <button className="btn-primary" onClick={() => handleApprove(cr.cr_id)} disabled={isProcessing}>
                        <Check size={16} />
                        Approve Change Request
                      </button>
                    )}

                    {isApproved && (
                      <button className="btn-primary" style={{ background: 'linear-gradient(135deg, var(--accent-emerald) 0%, #059669 100%)' }} onClick={() => handleExecute(cr.cr_id)} disabled={isProcessing}>
                        <Play size={16} />
                        Execute High-Impact Action
                      </button>
                    )}

                    {isExecuted && (
                      <button className="btn-danger" onClick={() => handleRollback(cr.cr_id)} disabled={isProcessing}>
                        <RotateCcw size={16} />
                        1-Click Reversible Rollback
                      </button>
                    )}

                    {isRolledBack && (
                      <span className="status-badge danger">Action Rolled Back to Original Snapshot</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'audit_log' && (
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={18} color="var(--accent-cyan)" />
              Immutable Audit Trail (SHA-256 Checksum Linkage)
            </h3>
            <span className="status-badge success">Cryptographically Linked Ledger</span>
          </div>

          <table className="custom-table">
            <thead>
              <tr>
                <th>Event ID</th>
                <th>Timestamp</th>
                <th>Event Type</th>
                <th>Actor</th>
                <th>Summary</th>
                <th>SHA-256 Checksum Hash</th>
              </tr>
            </thead>
            <tbody>
              {auditTrail.map(evt => (
                <tr key={evt.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-primary)' }}>{evt.id}</td>
                  <td style={{ fontSize: '0.78rem' }}>{new Date(evt.timestamp).toLocaleString()}</td>
                  <td>
                    <span className="status-badge info">{evt.event_type}</span>
                  </td>
                  <td style={{ fontWeight: 500 }}>{evt.actor}</td>
                  <td>{evt.summary}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                    {evt.hash.substring(0, 16)}...
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
