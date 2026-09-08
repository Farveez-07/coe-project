import React from 'react';
import { Award, AlertTriangle, TrendingDown, CheckCircle, HelpCircle, Activity } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function BacktestLabView({ backtestData }) {
  if (!backtestData) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading backtest evaluations...</div>;
  }

  const summary = backtestData.summary;
  const cutoffs = backtestData.cutoff_evaluations;

  const chartData = cutoffs.map(c => ({
    cutoff: `Day ${c.cutoff_day_index}`,
    date: c.cutoff_date,
    baselineError: c.baseline_error_days,
    proposedError: c.proposed_error_days
  }));

  const failureModes = [
    {
      title: "Unannounced Tenant Onboarding Surge",
      severity: "HIGH",
      description: "A state agency onboards 250k new benefit recipients without notifying DRE storage ops.",
      impact: "Model underestimates row ingestion by +45% until next 30-day baseline retraining window.",
      mitigation: "Automated trigger for real-time model re-fitting upon tenant registration event."
    },
    {
      title: "Shift in EOM Disbursement Calendar Schedule",
      severity: "MEDIUM",
      description: "State legislature shifts SNAP benefit disbursement date from the 28th to the 15th of the month.",
      impact: "Cyclical EOM features align on wrong day-of-month window, creating brief phase lag error.",
      mitigation: "Calendar schedule integration API reading official state disbursement holiday tables."
    },
    {
      title: "Index Bloat Non-Linear Split Spikes",
      severity: "HIGH",
      description: "GIN metadata index reaches B-Tree depth split threshold, causing sudden 3.5x size inflation.",
      impact: "Index bytes surge beyond linear extrapolation bounds within 48 hours.",
      mitigation: "Index bloat factor threshold warning + automated REINDEX CONCURRENTLY recommendation."
    },
    {
      title: "Retention Purge Job Execution Failure",
      severity: "HIGH",
      description: "Cron job executing 90-day claims partition drop fails silently due to DB lock contention.",
      impact: "Expired rows accumulate, causing actual storage to diverge upwards from retention decay curve.",
      mitigation: "Purge monitor heartbeat alert linked directly to governance audit trail."
    }
  ];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Benchmark Summary Header */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Award size={24} color="var(--accent-emerald)" />
            Backtest & Model Comparison Lab
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Evaluated against ground truth historical rolling cutoffs (Days 240 to 365)
          </p>
        </div>

        <div style={{ textAlign: 'right' }}>
          <span className="status-badge success" style={{ fontSize: '0.9rem', padding: '6px 14px' }}>
            {summary.overall_mae_improvement_pct}% Reduction in Exhaustion Date Forecast Error!
          </span>
        </div>
      </div>

      {/* Benchmark Metric Cards */}
      <div className="metrics-grid">
        <div className="glass-panel metric-card">
          <div className="metric-header">
            <span>Baseline DTE MAE</span>
            <AlertTriangle size={18} color="var(--accent-amber)" />
          </div>
          <div className="metric-value" style={{ color: 'var(--accent-amber)' }}>
            {summary.baseline_dte_mae} Days
          </div>
          <div className="metric-subtext">
            <span>Baseline OLS RMSE: <strong>{summary.baseline_dte_rmse} days</strong></span>
          </div>
        </div>

        <div className="glass-panel metric-card">
          <div className="metric-header">
            <span>Proposed DTE MAE</span>
            <CheckCircle size={18} color="var(--accent-emerald)" />
          </div>
          <div className="metric-value" style={{ color: 'var(--accent-emerald)' }}>
            {summary.proposed_dte_mae} Days
          </div>
          <div className="metric-subtext">
            <span>Proposed Model RMSE: <strong>{summary.proposed_dte_rmse} days</strong></span>
          </div>
        </div>

        <div className="glass-panel metric-card">
          <div className="metric-header">
            <span>Forecast Error Reduction</span>
            <TrendingDown size={18} color="var(--accent-cyan)" />
          </div>
          <div className="metric-value" style={{ color: 'var(--accent-cyan)' }}>
            {summary.overall_mae_improvement_pct}%
          </div>
          <div className="metric-subtext">
            <span>Substantial improvement in capacity breach timing</span>
          </div>
        </div>

        <div className="glass-panel metric-card">
          <div className="metric-header">
            <span>Ground Truth Exhaustion Day</span>
            <Activity size={18} color="var(--accent-purple)" />
          </div>
          <div className="metric-value">
            Day {backtestData.actual_exhaustion_day}
          </div>
          <div className="metric-subtext">
            <span>Date: <strong>2026-03-25</strong> (EOM Release Surge)</span>
          </div>
        </div>
      </div>

      {/* Error Comparison Chart */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'var(--font-display)', marginBottom: '4px' }}>
          Rolling Cutoff Days-To-Exhaustion (DTE) Forecast Error (Days)
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
          Lower is better. Shows how far predicted capacity exhaustion date was from ground truth exhaustion.
        </p>

        <div style={{ width: '100%', height: '300px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <XAxis dataKey="cutoff" stroke="#64748b" fontSize={11} />
              <YAxis stroke="#64748b" fontSize={11} unit=" days" />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
              <Legend wrapperStyle={{ paddingTop: '10px' }} />
              <Bar dataKey="baselineError" name="Baseline OLS Error (Days)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="proposedError" name="Proposed Model Error (Days)" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Rolling Cutoff Benchmark Table */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'var(--font-display)', marginBottom: '16px' }}>
          Backtest Evaluation Table across Rolling Historical Cutoffs
        </h3>

        <table className="custom-table">
          <thead>
            <tr>
              <th>Historical Cutoff</th>
              <th>Cutoff Date</th>
              <th>Actual DTE</th>
              <th>Baseline Pred DTE</th>
              <th>Baseline Error</th>
              <th>Proposed Pred DTE</th>
              <th>Proposed Error</th>
              <th>Error Reduction %</th>
            </tr>
          </thead>
          <tbody>
            {cutoffs.map(c => (
              <tr key={c.cutoff_day_index}>
                <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>Day {c.cutoff_day_index}</td>
                <td>{c.cutoff_date}</td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{c.actual_dte_days} days</td>
                <td style={{ fontFamily: 'var(--font-mono)' }}>{c.baseline_pred_dte} days</td>
                <td style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>{c.baseline_error_days} days</td>
                <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-emerald)', fontWeight: 600 }}>{c.proposed_pred_dte} days</td>
                <td style={{ color: 'var(--accent-emerald)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{c.proposed_error_days} days</td>
                <td>
                  <span className={`status-badge ${c.error_reduction_pct > 30 ? 'success' : 'info'}`}>
                    +{c.error_reduction_pct}% Error Red.
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Failure Mode & Prediction Failure Stress Test Cards */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <HelpCircle size={20} color="var(--accent-rose)" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'var(--font-display)' }}>
            Failure-Mode Analysis & Edge Case Stress Testing
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          {failureModes.map(fm => (
            <div key={fm.title} style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-sm)', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)' }}>{fm.title}</span>
                <span className="status-badge danger" style={{ fontSize: '0.68rem' }}>{fm.severity} RISK</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '8px' }}>{fm.description}</p>
              <div style={{ fontSize: '0.75rem', color: 'var(--accent-amber)', marginBottom: '6px' }}>
                <strong>Impact:</strong> {fm.impact}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)' }}>
                <strong>Mitigation:</strong> {fm.mitigation}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
