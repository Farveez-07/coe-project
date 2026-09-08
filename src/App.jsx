import React, { useState, useEffect } from 'react';
import { Database, TrendingUp, Award, Sliders, ShieldCheck, Presentation, RefreshCw } from 'lucide-react';
import OverviewView from './components/OverviewView';
import ForecasterView from './components/ForecasterView';
import BacktestLabView from './components/BacktestLabView';
import ScenarioSimulatorView from './components/ScenarioSimulatorView';
import GovernanceView from './components/GovernanceView';
import PresentationView from './components/PresentationView';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');

  const [dataset, setDataset] = useState(null);
  const [forecastData, setForecastData] = useState(null);
  const [backtestData, setBacktestData] = useState(null);
  const [auditTrail, setAuditTrail] = useState([]);
  const [changeRequests, setChangeRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [telRes, fcRes, btRes, auditRes, crRes] = await Promise.all([
        fetch('/api/telemetry'),
        fetch('/api/forecast?cutoff=365&forecast_days=180'),
        fetch('/api/backtest'),
        fetch('/api/governance/audit'),
        fetch('/api/governance/cr')
      ]);

      const tel = await telRes.json();
      const fc = await fcRes.json();
      const bt = await btRes.json();
      const audit = await auditRes.json();
      const cr = await crRes.json();

      setDataset(tel);
      setForecastData(fc);
      setBacktestData(bt);
      setAuditTrail(audit.audit_trail || []);
      setChangeRequests(cr.change_requests || []);
    } catch (err) {
      console.error('Failed to fetch API data from backend server:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top sticky header bar */}
      <header className="header-bar">
        <div className="brand-title">
          <Database size={22} color="var(--accent-primary)" />
          <span>Tenant-Aware Storage Capacity Forecaster</span>
          <span className="brand-badge">Public Benefits Systems</span>
        </div>

        <nav className="nav-tabs">
          <button
            className={`nav-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <Database size={16} />
            Overview
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'forecaster' ? 'active' : ''}`}
            onClick={() => setActiveTab('forecaster')}
          >
            <TrendingUp size={16} />
            Forecaster
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'backtest' ? 'active' : ''}`}
            onClick={() => setActiveTab('backtest')}
          >
            <Award size={16} />
            Backtest Lab
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'scenario' ? 'active' : ''}`}
            onClick={() => setActiveTab('scenario')}
          >
            <Sliders size={16} />
            Scenario Simulator
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'governance' ? 'active' : ''}`}
            onClick={() => setActiveTab('governance')}
          >
            <ShieldCheck size={16} />
            Governance & Rollback
          </button>
          <button
            className={`nav-tab-btn ${activeTab === 'presentation' ? 'active' : ''}`}
            onClick={() => setActiveTab('presentation')}
          >
            <Presentation size={16} />
            Presentation Deck
          </button>
        </nav>

        <button className="btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={fetchData}>
          <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
          Sync Data
        </button>
      </header>

      {/* Main Container */}
      <main className="app-container" style={{ flex: 1 }}>
        {isLoading && !dataset ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px', flexDirection: 'column', gap: '16px' }}>
            <div className="status-badge info" style={{ padding: '8px 18px', fontSize: '0.9rem' }}>
              Initializing Multi-Tenant Storage Capacity Telemetry...
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && (
              <OverviewView dataset={dataset} forecastData={forecastData} onNavigate={setActiveTab} />
            )}
            {activeTab === 'forecaster' && (
              <ForecasterView dataset={dataset} forecastData={forecastData} />
            )}
            {activeTab === 'backtest' && (
              <BacktestLabView backtestData={backtestData} />
            )}
            {activeTab === 'scenario' && (
              <ScenarioSimulatorView dataset={dataset} forecastData={forecastData} />
            )}
            {activeTab === 'governance' && (
              <GovernanceView auditTrail={auditTrail} changeRequests={changeRequests} onRefreshGovernance={fetchData} />
            )}
            {activeTab === 'presentation' && (
              <PresentationView />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '20px', borderTop: '1px solid var(--border-card)', fontSize: '0.78rem', color: 'var(--text-dim)' }}>
        CoE Project — Tenant-Aware Storage Capacity Forecaster at Table & Index Level for Public Benefits Processing Systems | High-Throughput EOM Peak Workloads
      </footer>
    </div>
  );
}
