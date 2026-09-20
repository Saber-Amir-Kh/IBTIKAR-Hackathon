import React from 'react';

interface SidebarProps {
  activeTab: 'map' | 'aid' | 'reforest';
  onSelectTab: (tab: 'map' | 'aid' | 'reforest') => void;
  needsCount: number;
  zonesCount: number;
  showDemoTools: boolean;
  onToggleDemoTools: () => void;
  onBackToLanding: () => void;
}

// 4-propeller clover logo from Figma
const DroneLogoIcon: React.FC<{ size?: number }> = ({ size = 32 }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="23" cy="23" r="13" stroke="#FCF8F6" strokeWidth="2.4" />
    <circle cx="41" cy="23" r="13" stroke="#FCF8F6" strokeWidth="2.4" />
    <circle cx="23" cy="41" r="13" stroke="#FCF8F6" strokeWidth="2.4" />
    <circle cx="41" cy="41" r="13" stroke="#FCF8F6" strokeWidth="2.4" />
    <circle cx="23" cy="23" r="5.5" stroke="#FCF8F6" strokeWidth="1.8" />
    <circle cx="41" cy="23" r="5.5" stroke="#FCF8F6" strokeWidth="1.8" />
    <circle cx="23" cy="41" r="5.5" stroke="#FCF8F6" strokeWidth="1.8" />
    <circle cx="41" cy="41" r="5.5" stroke="#FCF8F6" strokeWidth="1.8" />
    <circle cx="32" cy="32" r="3.2" fill="#FCF8F6" />
  </svg>
);

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  needsCount,
  zonesCount,
  showDemoTools,
  onToggleDemoTools,
  onBackToLanding,
}) => {
  return (
    <aside className="tactical-sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand" onClick={onBackToLanding} title="Retour à la page d'accueil">
        <DroneLogoIcon size={34} />
        <div className="brand-text-block">
          <span className="brand-name">SENTINELLE</span>
          <span className="brand-tag">TAJMAÂT OPS</span>
        </div>
      </div>

      {/* Main Navigation Items (Clean Typographic Indices, No Clipart Icons) */}
      <nav className="sidebar-nav">
        <button
          className={`sidebar-nav-btn ${activeTab === 'map' ? 'active' : ''}`}
          onClick={() => onSelectTab('map')}
          title="Carte Opérationnelle & Surveillance Drones"
        >
          <span className="nav-index">01</span>
          <span className="btn-label">Surveillance</span>
          {activeTab === 'map' && <span className="active-dot" />}
        </button>

        <button
          className={`sidebar-nav-btn ${activeTab === 'aid' ? 'active' : ''}`}
          onClick={() => onSelectTab('aid')}
          title="Entraide Communautaire (Touiza)"
        >
          <span className="nav-index">02</span>
          <span className="btn-label">Entraide Touiza</span>
          {needsCount > 0 ? (
            <span className="nav-badge">{needsCount}</span>
          ) : (
            activeTab === 'aid' && <span className="active-dot" />
          )}
        </button>

        <button
          className={`sidebar-nav-btn ${activeTab === 'reforest' ? 'active' : ''}`}
          onClick={() => onSelectTab('reforest')}
          title="Campagne de Reboisement & Parcelles"
        >
          <span className="nav-index">03</span>
          <span className="btn-label">Reboisement</span>
          {zonesCount > 0 ? (
            <span className="nav-badge green">{zonesCount}</span>
          ) : (
            activeTab === 'reforest' && <span className="active-dot" />
          )}
        </button>
      </nav>

      {/* Bottom Utility Actions (Simple, Clean, Typographic) */}
      <div className="sidebar-footer">
        <button
          className={`sidebar-util-btn ${showDemoTools ? 'active-demo' : ''}`}
          onClick={onToggleDemoTools}
          title="Panneau de simulation de feux factices"
        >
          <span className="util-bullet sim-bullet">●</span>
          <span>Simulation Démo</span>
        </button>

        <button
          className="sidebar-util-btn"
          onClick={onBackToLanding}
          title="Retour à la page vitrine"
        >
          <span className="util-bullet">←</span>
          <span>Site Vitrine</span>
        </button>
      </div>
    </aside>
  );
};
