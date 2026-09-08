import React, { useState } from 'react';
import { TrendingUp, AlertTriangle, ShieldCheck, Database, Calendar, Eye } from 'lucide-react';
import { ComposedChart, Line, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

export default function ForecasterView({ dataset, forecastData }) {
  const [selectedModel, setSelectedModel] = useState('proposed'); // 'proposed' or 'baseline'
  const [selectedTable, setSelectedTable] = useState('all'); // 'all' or specific table id

  if (!dataset || !forecastData) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading forecast data...</div>;
  }

  const limitGb = dataset.storage_limits.total_disk_limit_gb;
  const baseline = forecastData.baseline_model;
  const proposed = forecastData.proposed_model;

  // Prepare chart series
  const historySeries = dataset.telemetry.map(d => ({
    date: d.date,
    day_index: d.day_index,
    historical_gb: d.totals.total_gb,
    is_historical: true
  }));

  const forecastSeries = selectedModel === 'proposed'
    ? proposed.forecast.map(d => ({
        date: d.date,
        day_index: d.day_index,
        p10_gb: d.p10_gb,
        p50_gb: d.p50_gb,
        p90_gb: d.p90_gb,
        p95_gb: d.p95_gb,
        table_gb: selectedTable !== 'all' && d.table_breakdown[selectedTable] ? d.table_breakdown[selectedTable].total_gb : null,
        is_historical: false
      }))
    : baseline.forecast.map(d => ({
        date: d.date,
        day_index: d.day_index,
        p10_gb: d.p10_gb,
        p50_gb: d.pred_gb,
        p90_gb: d.p90_gb,
        p95_gb: d.p95_gb,
        is_historical: false
      }));

  const fullChartData = [...historySeries.slice(-60), ...forecastSeries];

  const activeDte = selectedModel === 'proposed' ? proposed.days_to_exhaustion_p50 : baseline.days_to_exhaustion;
  const activeExhaustionDate = selectedModel === 'proposed' ? proposed.exhaustion_date_p50 : baseline.exhaustion_date;

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header & Model Selector */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <TrendingUp size={24} color="var(--accent-primary)" />
            Capacity & Storage Exhaustion Forecaster
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Multi-Tenant Hierarchical & End-Of-Month (EOM) Decomposed Forecaster with Index Amplification & Retention Rules
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', background: 'rgba(15,23,42,0.8)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-card)' }}>
            <button
              style={{
                padding: '8px 16px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                background: selectedModel === 'proposed' ? 'var(--accent-primary)' : 'transparent',
                color: selectedModel === 'proposed' ? '#ffffff' : 'var(--text-muted)'
              }}
              onClick={() => setSelectedModel('proposed')}
            >
              Proposed Tenant-Aware Model
            </button>
            <button
              style={{
                padding: '8px 16px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                background: selectedModel === 'baseline' ? 'var(--accent-amber)' : 'transparent',
                color: selectedModel === 'baseline' ? '#000000' : 'var(--text-muted)'
              }}
              onClick={() => setSelectedModel('baseline')}
            >
              Baseline Aggregate OLS
            </button>
          </div>
        </div>
      </div>

      {/* Exhaustion Summary Metrics Grid */}
      <div className="metrics-grid">
        <div className="glass-panel metric-card">
          <div className="metric-header">
            <span>Predicted Days-To-Exhaustion (P50)</span>
            <Calendar size={18} color="var(--accent-cyan)" />
          </div>
          <div className="metric-value" style={{ color: activeDte < 90 ? 'var(--accent-rose)' : 'var(--text-main)' }}>
            {activeDte} Days
          </div>
          <div className="metric-subtext">
            <span>Target Breach Date: <strong>{activeExhaustionDate}</strong></span>
          </div>
        </div>

        {selectedModel === 'proposed' && (
          <>
            <div className="glass-panel metric-card">
              <div className="metric-header">
                <span>Pessimistic Horizon (P10)</span>
                <AlertTriangle size={18} color="var(--accent-rose)" />
              </div>
              <div className="metric-value" style={{ color: 'var(--accent-rose)' }}>
                {proposed.days_to_exhaustion_p10} Days
              </div>
              <div className="metric-subtext">
                <span>High EOM activity spike upper bound</span>
              </div>
            </div>

            <div className="glass-panel metric-card">
              <div className="metric-header">
                <span>Optimistic Horizon (P90)</span>
                <ShieldCheck size={18} color="var(--accent-emerald)" />
              </div>
              <div className="metric-value" style={{ color: 'var(--accent-emerald)' }}>
                {proposed.days_to_exhaustion_p90} Days
              </div>
              <div className="metric-subtext">
                <span>Lower tenant ingestion bound</span>
              </div>
            </div>
          </>
        )}

        <div className="glass-panel metric-card">
          <div className="metric-header">
            <span>Active Capacity Ceiling</span>
            <Database size={18} color="var(--accent-purple)" />
          </div>
          <div className="metric-value">{limitGb} GB</div>
          <div className="metric-subtext">
            <span>Disk Storage Quota Threshold</span>
          </div>
        </div>
      </div>

      {/* Main Forecast Visualizer */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'var(--font-display)' }}>
              180-Day Storage Trajectory & Probabilistic Confidence Bands
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {selectedModel === 'proposed' 
                ? 'Incorporating End-Of-Month disbursement surges, Index amplification, and Retention window decay.'
                : 'Simple OLS linear extrapolation on aggregate storage volume.'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Breakdown Table:</span>
            <select className="input-select" value={selectedTable} onChange={e => setSelectedTable(e.target.value)}>
              <option value="all">All Tables Aggregate</option>
              {dataset.tables.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.retention_days > 0 ? `${t.retention_days}d retention` : 'permanent'})</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ width: '100%', height: '380px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={fullChartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
              <defs>
                <linearGradient id="ciGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} domain={[0, Math.ceil(limitGb * 1.1)]} unit=" GB" />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
              
              <ReferenceLine y={limitGb} label={{ value: `STORAGE QUOTA LIMIT (${limitGb} GB)`, fill: '#f43f5e', fontSize: 11, fontWeight: 'bold' }} stroke="#f43f5e" strokeDasharray="4 4" />

              {/* Confidence Band */}
              {selectedModel === 'proposed' && selectedTable === 'all' && (
                <Area type="monotone" dataKey="p90_gb" name="P90 Confidence Bound" stroke="none" fill="url(#ciGlow)" />
              )}

              {/* Historical Trend */}
              <Line type="monotone" dataKey="historical_gb" name="Historical Observed (GB)" stroke="#06b6d4" strokeWidth={2} dot={false} />

              {/* Forecast Trajectory */}
              {selectedTable === 'all' ? (
                <Line type="monotone" dataKey="p50_gb" name={selectedModel === 'proposed' ? "P50 Expected Forecast (GB)" : "OLS Linear Forecast (GB)"} stroke="#6366f1" strokeWidth={3} dot={false} strokeDasharray={selectedModel === 'baseline' ? "5 5" : "none"} />
              ) : (
                <Line type="monotone" dataKey="table_gb" name={`${selectedTable} Predicted Footprint (GB)`} stroke="#a855f7" strokeWidth={3} dot={false} />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Model Technical Details & Key Differences */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: 600, fontFamily: 'var(--font-display)', marginBottom: '12px', color: 'var(--accent-amber)' }}>
            Approach A: Baseline Aggregate OLS Model
          </h4>
          <ul style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '18px' }}>
            <li>Operates strictly on top-level aggregate storage size (GB).</li>
            <li>Calculates linear slope: <strong>{baseline.slope_gb_per_day} GB/day</strong>.</li>
            <li><strong>Critical Flaw</strong>: Ignores tenant activity composition, periodic EOM disbursement spikes, and B-Tree index bloat non-linearities.</li>
            <li>Underestimates capacity exhaustion date during monthly benefit release peaks by up to 130 days.</li>
          </ul>
        </div>

        <div className="glass-panel" style={{ padding: '24px' }}>
          <h4 style={{ fontSize: '1rem', fontWeight: 600, fontFamily: 'var(--font-display)', marginBottom: '12px', color: 'var(--accent-primary)' }}>
            Approach B: Proposed Tenant-Aware Hierarchical Model
          </h4>
          <ul style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '18px' }}>
            <li>Decomposes row ingestion by individual state tenant activity rates.</li>
            <li>Models 5.2x End-Of-Month (EOM) transaction surges (25th–31st of each month).</li>
            <li>Models non-linear B-Tree splits and GIN index inflation bloat curves.</li>
            <li>Simulates retention purge sliding windows (e.g. 90-day claims history).</li>
            <li>Generates 150 Monte Carlo probabilistic trajectories with 80%/95% Confidence Intervals.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
