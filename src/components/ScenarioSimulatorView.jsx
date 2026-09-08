import React, { useState } from 'react';
import { Sliders, Play, RotateCcw, AlertTriangle, CheckCircle2, TrendingUp, Layers } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

export default function ScenarioSimulatorView({ dataset, forecastData }) {
  const [eomScale, setEomScale] = useState(1.0);
  const [newTenantWeight, setNewTenantWeight] = useState(0.0);
  const [claimsRetention, setClaimsRetention] = useState(90);
  const [docRetention, setDocRetention] = useState(60);

  const [simResult, setSimResult] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);

  if (!dataset || !forecastData) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading scenario engine...</div>;
  }

  const limitGb = dataset.storage_limits.total_disk_limit_gb;
  const originalProposed = forecastData.proposed_model;

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    try {
      const resp = await fetch('/api/scenario/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eom_multiplier_scale: eomScale,
          new_tenant_weight: newTenantWeight,
          modified_retention_days: {
            benefit_claims: claimsRetention,
            document_verifications: docRetention
          }
        })
      });
      const data = await resp.json();
      setSimResult(data.simulated_forecast);
    } catch (err) {
      console.error('Scenario simulation failed:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  const handleReset = () => {
    setEomScale(1.0);
    setNewTenantWeight(0.0);
    setClaimsRetention(90);
    setDocRetention(60);
    setSimResult(null);
  };

  // Compare original P50 vs simulated P50
  const activeSimForecast = simResult || originalProposed;
  
  const chartData = originalProposed.forecast.map((orig, idx) => {
    const simPoint = activeSimForecast.forecast[idx];
    return {
      date: orig.date,
      originalP50: orig.p50_gb,
      simulatedP50: simPoint ? simPoint.p50_gb : orig.p50_gb
    };
  });

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sliders size={24} color="var(--accent-cyan)" />
            "What-If" Capacity & Retention Scenario Simulator
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Simulate state tenant onboarding, EOM surge scaling, and retention policy alterations in real-time
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-secondary" onClick={handleReset}>
            <RotateCcw size={16} />
            Reset Parameters
          </button>
          <button className="btn-primary" onClick={handleRunSimulation} disabled={isSimulating}>
            <Play size={16} />
            {isSimulating ? 'Running Simulation...' : 'Run Scenario Simulation'}
          </button>
        </div>
      </div>

      {/* Simulator Controls & Output View */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        {/* Controls Panel */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, fontFamily: 'var(--font-display)', borderBottom: '1px solid var(--border-card)', paddingBottom: '10px' }}>
            Scenario Parameters
          </h3>

          {/* New Tenant Onboarding */}
          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 500, marginBottom: '8px' }}>
              <span>Onboard New State Agency (PA/OH)</span>
              <span style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>+{ (newTenantWeight * 100).toFixed(0) }% Workload</span>
            </label>
            <input
              type="range" min="0.0" max="0.5" step="0.05"
              value={newTenantWeight}
              onChange={e => setNewTenantWeight(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-cyan)' }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Simulates adding new state caseloads</span>
          </div>

          {/* EOM Surge Scaling */}
          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 500, marginBottom: '8px' }}>
              <span>EOM Surge Multiplier Scale</span>
              <span style={{ color: 'var(--accent-amber)', fontFamily: 'var(--font-mono)' }}>{ (eomScale * 5.2).toFixed(1) }x Surge</span>
            </label>
            <input
              type="range" min="0.8" max="2.0" step="0.1"
              value={eomScale}
              onChange={e => setEomScale(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent-amber)' }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Scales end-of-month benefit disbursement peak</span>
          </div>

          {/* Benefit Claims Retention Window */}
          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 500, marginBottom: '8px' }}>
              <span>benefit_claims Retention Window</span>
              <span style={{ color: 'var(--accent-primary)', fontFamily: 'var(--font-mono)' }}>{claimsRetention} Days</span>
            </label>
            <select className="input-select" style={{ width: '100%' }} value={claimsRetention} onChange={e => setClaimsRetention(Number(e.target.value))}>
              <option value={30}>30 Days (Aggressive Purge)</option>
              <option value={45}>45 Days (Moderate Purge)</option>
              <option value={60}>60 Days (Standard Purge)</option>
              <option value={90}>90 Days (Current Policy)</option>
              <option value={180}>180 Days (Extended Audit)</option>
            </select>
          </div>

          {/* Document Verifications Retention */}
          <div>
            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 500, marginBottom: '8px' }}>
              <span>document_verifications Retention</span>
              <span style={{ color: 'var(--accent-purple)', fontFamily: 'var(--font-mono)' }}>{docRetention} Days</span>
            </label>
            <select className="input-select" style={{ width: '100%' }} value={docRetention} onChange={e => setDocRetention(Number(e.target.value))}>
              <option value={30}>30 Days (Compressed Storage)</option>
              <option value={60}>60 Days (Current Policy)</option>
              <option value={90}>90 Days (Expanded History)</option>
            </select>
          </div>

          <button className="btn-primary" style={{ marginTop: 'auto', justifyContent: 'center' }} onClick={handleRunSimulation} disabled={isSimulating}>
            <Play size={16} />
            Apply Scenario Simulation
          </button>
        </div>

        {/* Simulation Output Chart */}
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, fontFamily: 'var(--font-display)' }}>
                Scenario Storage Trajectory Comparison
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Comparing baseline expected trajectory vs simulated parameter adjustments
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Simulated DTE (P50): </span>
              <strong style={{ fontSize: '1.1rem', color: activeSimForecast.days_to_exhaustion_p50 < 60 ? 'var(--accent-rose)' : 'var(--accent-emerald)', fontFamily: 'var(--font-mono)' }}>
                {activeSimForecast.days_to_exhaustion_p50} Days
              </strong>
            </div>
          </div>

          <div style={{ width: '100%', height: '320px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} domain={[0, Math.ceil(limitGb * 1.15)]} unit=" GB" />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }} />
                
                <ReferenceLine y={limitGb} label={{ value: `QUOTA CEILING (${limitGb} GB)`, fill: '#f43f5e', fontSize: 11, fontWeight: 'bold' }} stroke="#f43f5e" strokeDasharray="4 4" />

                <Line type="monotone" dataKey="originalP50" name="Original Expected P50 (GB)" stroke="#6366f1" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                <Line type="monotone" dataKey="simulatedP50" name="Simulated Scenario Trajectory (GB)" stroke="#06b6d4" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Scenario Impact Summary Callout */}
          <div style={{ marginTop: '20px', background: 'rgba(15,23,42,0.8)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-sm)', padding: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
            <TrendingUp size={24} color="var(--accent-cyan)" />
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {claimsRetention < 90 ? (
                <span style={{ color: 'var(--accent-emerald)' }}>
                  <strong>Capacity Impact:</strong> Reducing claims retention to {claimsRetention} days reclaims ~14.2 GB of storage, extending capacity exhaustion window by +{Math.max(0, activeSimForecast.days_to_exhaustion_p50 - originalProposed.days_to_exhaustion_p50)} days!
                </span>
              ) : newTenantWeight > 0 ? (
                <span style={{ color: 'var(--accent-rose)' }}>
                  <strong>Capacity Impact:</strong> Adding +{(newTenantWeight * 100).toFixed(0)}% state tenant workload accelerates exhaustion breach date forward by {Math.abs(activeSimForecast.days_to_exhaustion_p50 - originalProposed.days_to_exhaustion_p50)} days earlier.
                </span>
              ) : (
                <span>Adjust parameters on the left and click <strong>Run Scenario Simulation</strong> to evaluate capacity trade-offs.</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
