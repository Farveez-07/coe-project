import React from 'react';
import { Database, HardDrive, AlertTriangle, Layers, Calendar, ArrowUpRight, TrendingUp, Users } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function OverviewView({ dataset, forecastData, onNavigate }) {
  if (!dataset || !forecastData) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading system telemetry...</div>;
  }

  const latestTelemetry = dataset.telemetry[dataset.history_days - 1] || dataset.telemetry[0];
  const storageLimits = dataset.storage_limits;
  const currentTotalGb = latestTelemetry.totals.total_gb;
  const diskLimitGb = storageLimits.total_disk_limit_gb;
  const usagePct = ((currentTotalGb / diskLimitGb) * 100).toFixed(1);

  const proposedModel = forecastData.proposed_model;
  const dteP50 = proposedModel.days_to_exhaustion_p50;
  const exhaustionDate = proposedModel.exhaustion_date_p50;

  // Tenant pie chart data
  const tenantColors = ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#a855f7'];
  const tenantBreakdown = dataset.tenants.map((tn, idx) => {
    let totalBytes = 0;
    Object.values(latestTelemetry.tables).forEach(tbl => {
      if (tbl.tenant_breakdown[tn.id]) {
        totalBytes += tbl.tenant_breakdown[tn.id].tenant_bytes;
      }
    });
    return {
      name: tn.name,
      value: Number((totalBytes / (1024 ** 3)).toFixed(2)),
      color: tenantColors[idx % tenantColors.length]
    };
  });

  // Recent 30-day telemetry for trend chart
  const recent30 = dataset.telemetry.slice(dataset.history_days - 35, dataset.history_days);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Metric Summary Cards */}
      <div className="metrics-grid">
        <div className="glass-panel metric-card">
          <div className="metric-header">
            <span>Storage Utilization</span>
            <HardDrive size={18} color="var(--accent-cyan)" />
          </div>
          <div className="metric-value">{usagePct}%</div>
          <div className="metric-subtext">
            <span>{currentTotalGb.toFixed(1)} GB of {diskLimitGb} GB limit</span>
          </div>
          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', marginTop: '12px', overflow: 'hidden' }}>
            <div style={{ width: `${usagePct}%`, height: '100%', background: usagePct > 80 ? 'var(--accent-rose)' : 'var(--accent-cyan)', transition: 'width 0.4s ease' }}></div>
          </div>
        </div>

        <div className="glass-panel metric-card">
          <div className="metric-header">
            <span>Days to Exhaustion (P50)</span>
            <AlertTriangle size={18} color={dteP50 < 60 ? 'var(--accent-rose)' : 'var(--accent-amber)'} />
          </div>
          <div className="metric-value" style={{ color: dteP50 < 60 ? 'var(--accent-rose)' : 'var(--text-main)' }}>
            {dteP50} Days
          </div>
          <div className="metric-subtext">
            <span>Exhaustion Date: <strong>{exhaustionDate}</strong></span>
          </div>
          <div style={{ marginTop: '12px' }}>
            <span className={`status-badge ${dteP50 < 60 ? 'danger' : 'warning'}`}>
              {dteP50 < 60 ? 'CRITICAL BREACH WARNING' : 'APPROACHING QUOTA'}
            </span>
          </div>
        </div>

        <div className="glass-panel metric-card">
          <div className="metric-header">
            <span>End-Of-Month Peak Status</span>
            <Calendar size={18} color="var(--accent-primary)" />
          </div>
          <div className="metric-value" style={{ fontSize: '1.4rem' }}>
            {latestTelemetry.is_eom_peak ? 'ACTIVE EOM SURGE' : 'NORMAL INGEST'}
          </div>
          <div className="metric-subtext">
            <span>Peak Multiplier: <strong>{latestTelemetry.eom_multiplier}x</strong> baseline transaction volume</span>
          </div>
          <div style={{ marginTop: '12px' }}>
            <span className={`status-badge ${latestTelemetry.is_eom_peak ? 'warning' : 'success'}`}>
              {latestTelemetry.is_eom_peak ? '5.2x Disbursement Surge' : 'Baseline Processing'}
            </span>
          </div>
        </div>

        <div className="glass-panel metric-card">
          <div className="metric-header">
            <span>Active State Tenants</span>
            <Users size={18} color="var(--accent-emerald)" />
          </div>
          <div className="metric-value">{dataset.tenants.length} States</div>
          <div className="metric-subtext">
            <span>Top Tenant: <strong>CA Dept of Social Services</strong> (35% weight)</span>
          </div>
          <div style={{ marginTop: '12px' }}>
            <span className="status-badge success">Hierarchical Multi-Tenant</span>
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Storage Telemetry Trend */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'var(--font-display)' }}>Historical Storage Telemetry & Peak Spikes</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Table data vs Index bloat accumulation over recent 35 days</p>
            </div>
            <button className="btn-secondary" onClick={() => onNavigate('forecaster')}>
              <span>View Full Forecast</span>
              <ArrowUpRight size={16} />
            </button>
          </div>

          <div style={{ width: '100%', height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={recent30} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTable" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="colorIndex" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} unit=" GB" />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                <Area type="monotone" dataKey="totals.table_gb" name="Table Bytes (GB)" stroke="#6366f1" fillOpacity={1} fill="url(#colorTable)" />
                <Area type="monotone" dataKey="totals.index_gb" name="Index Bytes (GB)" stroke="#06b6d4" fillOpacity={1} fill="url(#colorIndex)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tenant Storage Breakdown */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'var(--font-display)', marginBottom: '4px' }}>Tenant Storage Share</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '16px' }}>Multi-tenant load contribution</p>

          <div style={{ width: '100%', height: '180px', margin: 'auto 0' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={tenantBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={45} paddingAngle={4}>
                  {tenantBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
            {tenantBreakdown.map(tn => (
              <div key={tn.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: tn.color }}></span>
                  {tn.name}
                </span>
                <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{tn.value} GB</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table & Index Storage Breakdown Grid */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'var(--font-display)', marginBottom: '16px' }}>
          Table & Index Storage Footprint Telemetry
        </h3>
        <table className="custom-table">
          <thead>
            <tr>
              <th>Table Name</th>
              <th>Retention Rule</th>
              <th>Active Rows</th>
              <th>Data Size (GB)</th>
              <th>Index Size (GB)</th>
              <th>Total Footprint</th>
              <th>Index-to-Data Amplification</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(latestTelemetry.tables).map(([tblId, tbl]) => {
              const dataGb = (tbl.data_bytes / (1024 ** 3)).toFixed(2);
              const indexGb = (tbl.index_bytes / (1024 ** 3)).toFixed(2);
              const totalGb = (tbl.total_bytes / (1024 ** 3)).toFixed(2);
              const ampFactor = (tbl.index_bytes / Math.max(1, tbl.data_bytes)).toFixed(2);
              const retRule = dataset.tables.find(t => t.id === tblId)?.retention_days;

              return (
                <tr key={tblId}>
                  <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{tbl.name}</td>
                  <td>
                    <span className={`status-badge ${retRule === 0 ? 'warning' : 'info'}`}>
                      {retRule === 0 ? 'Permanent' : `${retRule} Days Sliding`}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{tbl.active_rows.toLocaleString()}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{dataGb} GB</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{indexGb} GB</td>
                  <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>{totalGb} GB</td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', color: Number(ampFactor) > 1.2 ? 'var(--accent-amber)' : 'var(--text-muted)' }}>
                      {ampFactor}x ({((Number(ampFactor) / (1 + Number(ampFactor))) * 100).toFixed(0)}% Index Ratio)
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
