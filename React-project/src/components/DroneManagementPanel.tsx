import React, { useState } from 'react';
import {
  Compass,
  Battery,
  BatteryCharging,
  BatteryWarning,
  MapPin,
  Play,
  Pause,
  Home,
  Zap,
  Plus,
  Crosshair,
  Search,
  Video,
  Radio,
  AlertTriangle
} from 'lucide-react';
import type { DroneTelemetry } from '../types';
import { CustomSelect } from './CustomSelect';

interface DroneManagementPanelProps {
  drones: DroneTelemetry[];
  onSendCommand: (droneId: string, command: string, params?: Record<string, any>) => Promise<void>;
  onRecallAll: () => Promise<void>;
  onResumeAll: () => Promise<void>;
  onDeployDrone: (data: { name: string; sector: string; lat: number; lon: number; altitude?: number }) => Promise<void>;
  onNavigateToMapWithDrone?: (drone: DroneTelemetry) => void;
  onNavigateToFeed?: () => void;
}

const SECTOR_PRESETS = [
  { name: 'Parc National de Tikjda (Bouira)', lat: 36.455, lon: 4.135, alt: 420 },
  { name: 'Forêt Côtière Djebel Chenoua (Tipaza)', lat: 36.605, lon: 2.295, alt: 380 },
  { name: 'Massif Forestier Béni Yenni (Tizi Ouzou)', lat: 36.63, lon: 4.15, alt: 450 },
  { name: 'Parc National de Chréa (Blida)', lat: 36.425, lon: 2.875, alt: 480 },
  { name: 'Forêt d\'Akfadou (Béjaïa)', lat: 36.72, lon: 4.60, alt: 510 },
  { name: 'Parc National d\'El Kala (El Tarf)', lat: 36.88, lon: 8.44, alt: 290 },
];

export const DroneManagementPanel: React.FC<DroneManagementPanelProps> = ({
  drones,
  onSendCommand,
  onRecallAll,
  onResumeAll,
  onDeployDrone,
  onNavigateToMapWithDrone,
  onNavigateToFeed,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [busyDrones, setBusyDrones] = useState<Record<string, boolean>>({});

  // Deploy Form State
  const [newName, setNewName] = useState('');
  const [newSector, setNewSector] = useState(SECTOR_PRESETS[3].name);
  const [newLat, setNewLat] = useState<number>(SECTOR_PRESETS[3].lat);
  const [newLon, setNewLon] = useState<number>(SECTOR_PRESETS[3].lon);
  const [newAlt, setNewAlt] = useState<number>(SECTOR_PRESETS[3].alt);
  const [isDeploying, setIsDeploying] = useState(false);

  const handleCommand = async (droneId: string, cmd: string, params?: Record<string, any>) => {
    setBusyDrones((prev) => ({ ...prev, [droneId]: true }));
    try {
      await onSendCommand(droneId, cmd, params);
    } finally {
      setTimeout(() => {
        setBusyDrones((prev) => ({ ...prev, [droneId]: false }));
      }, 500);
    }
  };

  const handlePresetSelect = (presetName: string) => {
    const found = SECTOR_PRESETS.find((p) => p.name === presetName);
    if (found) {
      setNewSector(found.name);
      setNewLat(found.lat);
      setNewLon(found.lon);
      setNewAlt(found.alt);
    }
  };

  const submitDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setIsDeploying(true);
    try {
      await onDeployDrone({
        name: newName.trim(),
        sector: newSector,
        lat: Number(newLat),
        lon: Number(newLon),
        altitude: Number(newAlt),
      });
      setShowDeployModal(false);
      setNewName('');
    } catch (err: any) {
      alert('Erreur déploiement drone : ' + err.message);
    } finally {
      setIsDeploying(false);
    }
  };

  // Filtered Drones
  const filteredDrones = drones.filter((d) => {
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'ACTIVE' && d.status !== 'PATROL_ACTIVE' && d.status !== 'HOVER_SCAN') return false;
      if (statusFilter === 'HOVER' && d.status !== 'HOVER_SCAN') return false;
      if (statusFilter === 'RTH' && d.status !== 'RETURN_TO_HOME') return false;
      if (statusFilter === 'CHARGING' && d.status !== 'CHARGING' && d.status !== 'STANDBY') return false;
    }
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchId = d.droneId.toLowerCase().includes(q);
      const matchName = d.name.toLowerCase().includes(q);
      const matchSector = (d.sector || '').toLowerCase().includes(q);
      const matchModel = (d.model || '').toLowerCase().includes(q);
      if (!matchId && !matchName && !matchSector && !matchModel) return false;
    }
    return true;
  });

  const activeCount = drones.filter((d) => d.status === 'PATROL_ACTIVE' || d.status === 'HOVER_SCAN').length;
  const avgBattery = drones.length > 0
    ? (drones.reduce((acc, d) => acc + d.battery, 0) / drones.length).toFixed(1)
    : '0';

  return (
    <div className="drone-management-container">
      {/* Top Banner */}
      <div className="drone-mgmt-header">
        <div className="drone-mgmt-title-block">
          <div className="drone-title-icon-box">
            <Radio size={24} className="text-cyan animate-pulse" />
          </div>
          <div>
            <h3>Flotte Drones & Télémétrie de Surveillance</h3>
            <p>
              Supervision en temps réel des drones patrouilleurs, pilotage autonome des orbites, balayage stationnaire thermique et retour d'urgence (RTH).
            </p>
          </div>
        </div>

        {/* Global Fleet Actions */}
        <div className="fleet-global-actions">
          <button
            className="btn-fleet-act recall"
            onClick={onRecallAll}
            title="Ordonner le retour immédiat à la base pour tous les drones"
          >
            <Home size={14} />
            <span>RTH Global (Rappeler tous)</span>
          </button>

          <button
            className="btn-fleet-act resume"
            onClick={onResumeAll}
            title="Reprendre les patrouilles orbitales sur tous les secteurs"
          >
            <Play size={14} />
            <span>Reprendre Tout</span>
          </button>

          <button
            className="btn-fleet-act deploy"
            onClick={() => setShowDeployModal(true)}
            title="Déployer un nouveau drone de patrouille"
          >
            <Plus size={14} />
            <span>Déployer Drone</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="drone-kpi-grid">
        <div
          className={`drone-kpi-card ${statusFilter === 'ALL' ? 'active-filter' : ''}`}
          onClick={() => setStatusFilter('ALL')}
        >
          <span className="kpi-num">{drones.length}</span>
          <span className="kpi-label">Flotte Totale</span>
        </div>

        <div
          className={`drone-kpi-card green ${statusFilter === 'ACTIVE' ? 'active-filter' : ''}`}
          onClick={() => setStatusFilter('ACTIVE')}
        >
          <span className="kpi-num">{activeCount}</span>
          <span className="kpi-label">En Vol Actif</span>
        </div>

        <div
          className={`drone-kpi-card amber ${statusFilter === 'HOVER' ? 'active-filter' : ''}`}
          onClick={() => setStatusFilter('HOVER')}
        >
          <span className="kpi-num">{drones.filter((d) => d.status === 'HOVER_SCAN').length}</span>
          <span className="kpi-label">Stationnaires (Scan IR)</span>
        </div>

        <div
          className={`drone-kpi-card blue ${statusFilter === 'RTH' ? 'active-filter' : ''}`}
          onClick={() => setStatusFilter('RTH')}
        >
          <span className="kpi-num">{drones.filter((d) => d.status === 'RETURN_TO_HOME').length}</span>
          <span className="kpi-label">Retour Base (RTH)</span>
        </div>

        <div className="drone-kpi-card cyan">
          <span className="kpi-num">{avgBattery}%</span>
          <span className="kpi-label">Batterie Flotte Moyenne</span>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="drone-filters-bar">
        <div className="drone-search-wrap">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            className="drone-search-input"
            placeholder="Rechercher par identifiant, nom, modèle, secteur..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="btn-clear-search" onClick={() => setSearchQuery('')}>
              ×
            </button>
          )}
        </div>

        <div className="fleet-telemetry-badge">
          <span className="telemetry-live-dot" />
          <span>Télémétrie 1Hz • Fréquence 5.8 GHz & 4G LTE</span>
        </div>
      </div>

      {/* Drones Cards Grid */}
      <div className="drone-card-grid">
        {filteredDrones.length === 0 ? (
          <div className="empty-drones-box">
            <AlertTriangle size={32} className="empty-icon" />
            <h4>Aucun drone ne correspond à ces critères</h4>
            <p>Vérifiez vos filtres de recherche ou déployez un nouveau drone.</p>
          </div>
        ) : (
          filteredDrones.map((d) => {
            const isBusy = busyDrones[d.droneId];
            const isBatteryLow = d.battery < 25;
            const isBatteryMid = d.battery >= 25 && d.battery < 60;

            let statusLabel = 'En Patrouille';
            let statusPillClass = 'pill-active';
            if (d.status === 'HOVER_SCAN') {
              statusLabel = 'Stationnaire / Scan';
              statusPillClass = 'pill-hover';
            } else if (d.status === 'RETURN_TO_HOME' || d.status === 'RTH') {
              statusLabel = 'Retour Base (RTH)';
              statusPillClass = 'pill-rth';
            } else if (d.status === 'CHARGING') {
              statusLabel = 'Recharge Base';
              statusPillClass = 'pill-charging';
            } else if (d.status === 'STANDBY') {
              statusLabel = 'En Attente';
              statusPillClass = 'pill-standby';
            }

            return (
              <div key={d.droneId} className={`drone-item-card border-${d.status.toLowerCase()}`}>
                {/* Drone Card Header */}
                <div className="drone-card-header">
                  <div className="drone-id-block">
                    <div className="drone-rotor-icon">
                      <span className="rotor rotor-1" />
                      <span className="rotor rotor-2" />
                      <span className="rotor-core">✦</span>
                    </div>
                    <div>
                      <div className="drone-name-row">
                        <span className="drone-id-tag">{d.droneId}</span>
                        <span className={`drone-status-pill ${statusPillClass}`}>{statusLabel}</span>
                      </div>
                      <span className="drone-fullname">{d.name}</span>
                    </div>
                  </div>

                  <span className="drone-model-tag">{d.model || 'Hexacopter Surveillance'}</span>
                </div>

                {/* Battery & Link Level Gauges */}
                <div className="drone-gauges-row">
                  <div className="gauge-item">
                    <div className="gauge-header">
                      <span className="gauge-label">
                        {d.status === 'CHARGING' ? (
                          <BatteryCharging size={13} className="text-cyan" />
                        ) : isBatteryLow ? (
                          <BatteryWarning size={13} className="text-red" />
                        ) : (
                          <Battery size={13} className={isBatteryMid ? 'text-amber' : 'text-green'} />
                        )}
                        <span>Batterie</span>
                      </span>
                      <span className="gauge-val font-bold">{d.battery.toFixed(0)}%</span>
                    </div>
                    <div className="gauge-progress-bar">
                      <div
                        className={`gauge-fill ${isBatteryLow ? 'bg-red' : isBatteryMid ? 'bg-amber' : 'bg-green'}`}
                        style={{ width: `${Math.min(100, Math.max(0, d.battery))}%` }}
                      />
                    </div>
                  </div>

                  <div className="gauge-item">
                    <div className="gauge-header">
                      <span className="gauge-label">
                        <Radio size={13} className="text-cyan" />
                        <span>Signal Liaisons</span>
                      </span>
                      <span className="gauge-val font-mono">98% RSSI</span>
                    </div>
                    <div className="gauge-progress-bar">
                      <div className="gauge-fill bg-cyan" style={{ width: '98%' }} />
                    </div>
                  </div>
                </div>

                {/* Telemetry Metrics */}
                <div className="drone-metrics-grid">
                  <div className="metric-cell">
                    <span className="m-label">Altitude</span>
                    <span className="m-value font-mono">{d.altitude.toFixed(0)} m</span>
                  </div>
                  <div className="metric-cell">
                    <span className="m-label">Cap</span>
                    <span className="m-value font-mono flex items-center gap-1">
                      <Compass size={12} className="text-muted" />
                      {d.heading.toFixed(0)}°
                    </span>
                  </div>
                  <div className="metric-cell col-span-2">
                    <span className="m-label">Position GPS</span>
                    <span className="m-value font-mono text-xs">
                      {d.lat.toFixed(4)}°N, {d.lon.toFixed(4)}°E
                    </span>
                  </div>
                </div>

                {/* Sector Assignment */}
                <div className="drone-sector-box">
                  <div className="sector-header">
                    <MapPin size={12} className="text-red" />
                    <span className="sector-lbl">Secteur Affecté :</span>
                  </div>
                  <div className="sector-name-row">
                    <span className="sector-name font-bold">{d.sector || 'Patrouille Générale'}</span>
                  </div>
                </div>

                {/* Tactical Actions Toolbar */}
                <div className="drone-actions-toolbar">
                  {/* Patrol or Hover toggle */}
                  {d.status === 'HOVER_SCAN' ? (
                    <button
                      className="btn-drone-act resume"
                      onClick={() => handleCommand(d.droneId, 'RESUME_PATROL')}
                      disabled={isBusy}
                      title="Reprendre la patrouille orbitale"
                    >
                      <Play size={13} />
                      <span>Patrouille</span>
                    </button>
                  ) : (
                    <button
                      className="btn-drone-act hover"
                      onClick={() => handleCommand(d.droneId, 'HOVER')}
                      disabled={isBusy}
                      title="Immobiliser le drone en vol stationnaire pour balayer un secteur suspect"
                    >
                      <Pause size={13} />
                      <span>Stationnaire</span>
                    </button>
                  )}

                  {/* Return to Home (RTH) */}
                  <button
                    className={`btn-drone-act rth ${d.status === 'RETURN_TO_HOME' ? 'active-rth' : ''}`}
                    onClick={() => handleCommand(d.droneId, 'RETURN_TO_HOME')}
                    disabled={isBusy || d.status === 'RETURN_TO_HOME'}
                    title="Rappeler ce drone vers son point de décollage initial (RTH)"
                  >
                    <Home size={13} />
                    <span>RTH</span>
                  </button>

                  {/* Quick Recharge */}
                  <button
                    className="btn-drone-act recharge"
                    onClick={() => handleCommand(d.droneId, 'RECHARGE')}
                    disabled={isBusy}
                    title="Remplacer/recharger la batterie (Simulation 100%)"
                  >
                    <Zap size={13} />
                    <span>100%</span>
                  </button>

                  {/* Locate on Map */}
                  <button
                    className="btn-drone-act locate"
                    onClick={() => onNavigateToMapWithDrone?.(d)}
                    title="Afficher et centrer sur la carte opérationnelle"
                  >
                    <Crosshair size={13} />
                    <span>Carte</span>
                  </button>

                  {/* Live Feed Shortcut */}
                  <button
                    className="btn-drone-act video"
                    onClick={onNavigateToFeed}
                    title="Ouvrir le flux vidéo optique et thermique"
                  >
                    <Video size={13} />
                    <span>Flux</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Deploy New Drone Modal */}
      {showDeployModal && (
        <div className="modal-overlay modal-backdrop" onClick={() => setShowDeployModal(false)}>
          <div className="modal-card deploy-drone-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <div className="title-icon-box">
                  <Plus size={20} className="text-cyan" />
                </div>
                <div>
                  <h3 className="modal-title">Déployer un Nouveau Drone de Surveillance</h3>
                  <p className="modal-subtitle">Ajoutez une unité aérienne sur un secteur forestier stratégique</p>
                </div>
              </div>
              <button className="btn-close-modal" onClick={() => setShowDeployModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={submitDeploy} className="deploy-form">
              <div className="form-group">
                <label className="form-label">Nom du Drone</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Ex: Sentinelle Chréa-4"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Secteur Stratégique (Préréglage)</label>
                <CustomSelect
                  value={newSector}
                  options={SECTOR_PRESETS.map((p) => ({
                    value: p.name,
                    label: p.name,
                    icon: <MapPin size={14} className="text-cyan" />,
                    sublabel: `${p.lat.toFixed(3)}°N, ${p.lon.toFixed(3)}°E • Alt: ${p.alt}m`
                  }))}
                  onChange={(val) => handlePresetSelect(val)}
                  placeholder="Sélectionner un secteur stratégique..."
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Latitude (°N)</label>
                  <input
                    type="number"
                    step="0.001"
                    className="form-input"
                    value={newLat}
                    onChange={(e) => setNewLat(parseFloat(e.target.value))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Longitude (°E)</label>
                  <input
                    type="number"
                    step="0.001"
                    className="form-input"
                    value={newLon}
                    onChange={(e) => setNewLon(parseFloat(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Altitude de Croisière (m AGL)</label>
                <input
                  type="number"
                  step="10"
                  className="form-input"
                  value={newAlt}
                  onChange={(e) => setNewAlt(parseFloat(e.target.value))}
                  required
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowDeployModal(false)}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-cyan"
                  disabled={isDeploying}
                >
                  {isDeploying ? 'Déploiement en cours...' : '🚀 Lancer Déploiement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
