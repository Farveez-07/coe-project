import React, { useState } from 'react';
import { Presentation, ChevronLeft, ChevronRight, CheckCircle2, Cpu, BarChart2, ShieldCheck, Zap } from 'lucide-react';

export default function PresentationView() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      title: "Tenant-Aware Storage Capacity Forecaster",
      subtitle: "For Public Benefits Systems Processing End-Of-Month (EOM) Peak Workloads",
      badge: "CoE Project Defense & Evaluation",
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
            <h4 style={{ color: 'var(--accent-primary)', marginBottom: '8px', fontSize: '1.1rem' }}>Problem Statement</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.6' }}>
              Public benefits systems (SNAP, Medicaid, TANF) experience extreme 5x–10x transaction peaks at the End-Of-Month (EOM) during benefit disbursements. Historically, storage capacity was added reactively because growth by tenant and table was not forecast, leading to emergency database outages and disk exhaustion during critical disbursement windows.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-sm)', padding: '16px' }}>
              <h5 style={{ color: 'var(--accent-cyan)', marginBottom: '6px' }}>Core Objective</h5>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Design and validate a tenant-aware, table-level and index-level storage capacity forecaster that predicts exact Days-To-Exhaustion (DTE) dates under EOM peak stress.
              </p>
            </div>
            <div style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-sm)', padding: '16px' }}>
              <h5 style={{ color: 'var(--accent-emerald)', marginBottom: '6px' }}>Key Innovation</h5>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Multi-tenant activity decomposition + EOM cyclical Fourier features + GIN/B-Tree index bloat amplification modeling + 1-click reversible rollback governance.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "System Architecture & Field Workflow",
      subtitle: "End-to-End Data Telemetry to Capacity Governance",
      badge: "Architecture & Workflow",
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-sm)', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--accent-cyan)', fontWeight: 600 }}>
                <Cpu size={18} /> 1. Telemetry Capture
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Collects daily row growth, tenant attribution (CA, NY, TX, FL, IL), table byte size, and B-Tree/GIN index metrics.
              </p>
            </div>

            <div style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-sm)', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--accent-primary)', fontWeight: 600 }}>
                <BarChart2 size={18} /> 2. Hierarchical Forecast
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Runs 150 Monte Carlo simulations modeling tenant baseline rates, EOM multipliers, and retention sliding purges with 80%/95% CIs.
              </p>
            </div>

            <div style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-sm)', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: 'var(--accent-emerald)', fontWeight: 600 }}>
                <ShieldCheck size={18} /> 3. Review & Rollback
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                DRE Change Request approval workflow for high-impact actions (Partition Purge, Index Defrag) with 1-click reversible rollbacks.
              </p>
            </div>
          </div>

          <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px dashed var(--border-card)', borderRadius: 'var(--radius-sm)', padding: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            <strong>Field Workflow Integration:</strong> System operates continuously as a sidecar agent monitoring PostgreSQL/Oracle database tablespaces. Automatically flags critical Days-to-Exhaustion warnings (&lt; 60 days) to Database Reliability Engineers.
          </div>
        </div>
      )
    },
    {
      title: "Technical Approach Comparison & Design Justification",
      subtitle: "Rigorous Evaluation of Baseline OLS vs Proposed Model",
      badge: "Technical Comparison",
      content: (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
            <h4 style={{ color: 'var(--accent-amber)', marginBottom: '10px' }}>Approach A: Baseline OLS Linear</h4>
            <ul style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '16px' }}>
              <li>Operates on total aggregate storage size.</li>
              <li>Fits a single straight line slope across all past days.</li>
              <li><strong>Major Defect:</strong> Completely smooths out monthly benefit release surges (5x spikes).</li>
              <li><strong>Result:</strong> Misses capacity exhaustion timing during EOM releases by 104+ days!</li>
            </ul>
          </div>

          <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
            <h4 style={{ color: 'var(--accent-primary)', marginBottom: '10px' }}>Approach B: Proposed Tenant-Aware Model</h4>
            <ul style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '16px' }}>
              <li>Decomposes growth rate per tenant and per table.</li>
              <li>Models 5.2x End-Of-Month cyclical disbursement spikes.</li>
              <li>Models B-Tree depth splits and GIN metadata index bloat.</li>
              <li>Simulates sliding window retention purges (e.g. 90-day claims).</li>
              <li><strong>Result:</strong> Reduces exhaustion date forecast error by <strong>50.38%</strong>!</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      title: "Quantitative Validation & Backtesting Benchmark Results",
      subtitle: "Empirical Proof of Forecast Accuracy Improvement",
      badge: "Measured Results",
      content: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', textAlign: 'center' }}>
            <div style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid var(--border-card)', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Baseline DTE MAE</span>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--accent-amber)', fontFamily: 'var(--font-display)' }}>104.4 Days</div>
            </div>

            <div style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid var(--border-card)', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Proposed Model DTE MAE</span>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--accent-emerald)', fontFamily: 'var(--font-display)' }}>51.8 Days</div>
            </div>

            <div style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid var(--border-card)', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Error Reduction</span>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--accent-cyan)', fontFamily: 'var(--font-display)' }}>50.38%</div>
            </div>
          </div>

          <table className="custom-table" style={{ fontSize: '0.8rem' }}>
            <thead>
              <tr>
                <th>Historical Cutoff</th>
                <th>Actual DTE</th>
                <th>Baseline Error</th>
                <th>Proposed Error</th>
                <th>Error Reduction %</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Cutoff Day 300</td>
                <td>149 days</td>
                <td>131 days off</td>
                <td style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>27 days off</td>
                <td><span className="status-badge success">+79.39%</span></td>
              </tr>
              <tr>
                <td>Cutoff Day 330</td>
                <td>119 days</td>
                <td>161 days off</td>
                <td style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>33 days off</td>
                <td><span className="status-badge success">+79.50%</span></td>
              </tr>
              <tr>
                <td>Cutoff Day 365</td>
                <td>84 days</td>
                <td>58 days off</td>
                <td style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>27 days off</td>
                <td><span className="status-badge success">+53.45%</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      )
    },
    {
      title: "Uniqueness, Functionality & Key Contributions",
      subtitle: "Summary of Individual Project Engineering Deliverables",
      badge: "Project Deliverables",
      content: (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
            <h4 style={{ color: 'var(--accent-cyan)', marginBottom: '10px' }}>Production Functionality</h4>
            <ul style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '16px' }}>
              <li>Full-stack functional web dashboard with live forecast visualizers.</li>
              <li>"What-If" scenario simulator for state onboarding & retention tweaks.</li>
              <li>SHA-256 cryptographic audit trail and DRE approval queue.</li>
              <li>Reversible 1-click rollback engine for high-impact capacity actions.</li>
            </ul>
          </div>

          <div style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-md)', padding: '20px' }}>
            <h4 style={{ color: 'var(--accent-purple)', marginBottom: '10px' }}>Individual Contribution</h4>
            <ul style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: '16px' }}>
              <li>Designed tenant decomposition & index bloat mathematical formulation.</li>
              <li>Implemented end-to-end Python ML forecaster and REST backend.</li>
              <li>Created realistic multi-tenant public benefits database telemetry generator.</li>
              <li>Authored comprehensive technical documentation, failure analysis, and field workflow map.</li>
            </ul>
          </div>
        </div>
      )
    }
  ];

  const slide = slides[currentSlide];

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Slide Player Box */}
      <div className="glass-panel" style={{ padding: '36px', minHeight: '520px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          {/* Header Badge & Title */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span className="status-badge info">{slide.badge}</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Slide {currentSlide + 1} of {slides.length}
            </span>
          </div>

          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, fontFamily: 'var(--font-display)', marginBottom: '6px' }}>
            {slide.title}
          </h1>
          <h3 style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-muted)', marginBottom: '28px' }}>
            {slide.subtitle}
          </h3>

          {/* Slide Content */}
          <div>{slide.content}</div>
        </div>

        {/* Slide Controls Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-card)', paddingTop: '20px', marginTop: '28px' }}>
          <button
            className="btn-secondary"
            onClick={() => setCurrentSlide(prev => Math.max(0, prev - 1))}
            disabled={currentSlide === 0}
            style={{ opacity: currentSlide === 0 ? 0.5 : 1 }}
          >
            <ChevronLeft size={18} />
            Previous Slide
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            {slides.map((_, idx) => (
              <span
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                style={{
                  width: '12px', height: '12px', borderRadius: '50%', cursor: 'pointer',
                  background: currentSlide === idx ? 'var(--accent-primary)' : 'rgba(255,255,255,0.15)',
                  transition: 'all 0.2s ease'
                }}
              />
            ))}
          </div>

          <button
            className="btn-primary"
            onClick={() => setCurrentSlide(prev => Math.min(slides.length - 1, prev + 1))}
            disabled={currentSlide === slides.length - 1}
            style={{ opacity: currentSlide === slides.length - 1 ? 0.5 : 1 }}
          >
            Next Slide
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
