import React, { useState } from 'react';
import {
  Trash2,
  CheckCircle2,
  MapPin,
  Search,
  Flame,
  Users,
  Eye,
  Crosshair,
  Filter,
  AlertTriangle
} from 'lucide-react';
import type { Incident, IncidentStatus } from '../types';

interface FireManagementPanelProps {
  incidents: Incident[];
  selectedIncident: Incident | null;
  onSelectIncident: (incident: Incident) => void;
  onInspectIncident: (incident: Incident) => void;
  onDeleteIncident: (id: number) => void;
  onKeepIncident: (incident: Incident) => void;
  onAssignTeam: (incidentId: number, teamName: string) => void;
  assignedTeams: Record<number, string>;
  mapFilter: 'ALL' | 'ACTIVE_ONLY';
  onToggleMapFilter: (filter: 'ALL' | 'ACTIVE_ONLY') => void;
  onClearDismissed: () => void;
  onNavigateToMap?: () => void;
}

const TEAMS = [
  { id: 'protection_civile', name: 'Protection Civile (Sapeurs-Pompiers)', icon: '🛡️' },
  { id: 'tajmaat_committee', name: 'Comité Tajmaât (Chefs de Village)', icon: '🏛️' },
  { id: 'touiza_volunteers', name: 'Brigade Bénévoles Touiza', icon: '🤝' },
  { id: 'eco_club', name: 'Club Écologique & Reboisement', icon: '🌲' },
  { id: 'drone_pilots', name: 'Équipe Télépilotes Surveillance', icon: '🚁' },
];

export const FireManagementPanel: React.FC<FireManagementPanelProps> = ({
  incidents,
  selectedIncident,
  onSelectIncident,
  onInspectIncident,
  onDeleteIncident,
  onKeepIncident,
  onAssignTeam,
  assignedTeams,
  mapFilter,
  onToggleMapFilter,
  onClearDismissed,
  onNavigateToMap,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | IncidentStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState<string>('ALL');

  // Filtered incidents
  const filteredIncidents = incidents.filter((inc) => {
    if (statusFilter !== 'ALL' && inc.status !== statusFilter) return false;

    const assigned = assignedTeams[inc.id] || '';
    if (teamFilter !== 'ALL') {
      if (teamFilter === 'UNASSIGNED' && assigned !== '') return false;
      if (teamFilter !== 'UNASSIGNED' && assigned !== teamFilter) return false;
    }

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      const matchId = inc.id.toString().includes(q);
      const matchDrone = inc.droneId.toLowerCase().includes(q);
      const matchLabel = inc.label.toLowerCase().includes(q);
      const matchTeam = assigned.toLowerCase().includes(q);
      if (!matchId && !matchDrone && !matchLabel && !matchTeam) return false;
    }

    return true;
  });

  const activeCount = incidents.filter((i) => i.status === 'ACTIVE').length;
  const pendingCount = incidents.filter((i) => i.status === 'PENDING_VERIFICATION').length;
  const containedCount = incidents.filter((i) => i.status === 'CONTAINED').length;
  const dismissedCount = incidents.filter((i) => i.status === 'DISMISSED').length;

  return (
    <div className="fire-management-container">
      {/* Top Banner & Anti-Saturation Alert */}
      <div className="fire-mgmt-header">
        <div className="fire-mgmt-title-block">
          <div className="title-icon-box">
            <Flame size={24} className="text-red" />
          </div>
          <div>
            <h3>Gestion des Feux & Déploiement des Équipes</h3>
            <p>
              Surveillez, assignez des équipes de terrain, confirmez les feux prioritaires et supprimez les fausses alertes pour désaturer la carte.
            </p>
          </div>
        </div>

        {/* Anti-saturation quick bar */}
        <div className="anti-saturation-controls">
          <div className="saturation-info">
            <span className="saturation-dot" />
            <span>
              Saturation carte : <strong>{incidents.length} feux répertoriés</strong>
            </span>
          </div>

          <div className="saturation-toggle-wrap">
            <button
              className={`btn-sat-toggle ${mapFilter === 'ACTIVE_ONLY' ? 'active' : ''}`}
              onClick={() => onToggleMapFilter(mapFilter === 'ACTIVE_ONLY' ? 'ALL' : 'ACTIVE_ONLY')}
              title="Masquer les feux inactifs ou rejetés sur la carte"
            >
              <Filter size={14} />
              <span>{mapFilter === 'ACTIVE_ONLY' ? 'Carte Filtrée (Actifs seuls)' : 'Carte Complète (Tous)'}</span>
            </button>

            {dismissedCount > 0 && (
              <button
                className="btn-sat-action danger"
                onClick={onClearDismissed}
                title="Supprimer tous les feux rejetés pour libérer l'espace"
              >
                <Trash2 size={14} />
                <span>Nettoyer {dismissedCount} rejets</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="fire-kpi-grid">
        <div
          className={`fire-kpi-card ${statusFilter === 'ALL' ? 'active-filter' : ''}`}
          onClick={() => setStatusFilter('ALL')}
        >
          <span className="kpi-num">{incidents.length}</span>
          <span className="kpi-label">Total Détections</span>
        </div>

        <div
          className={`fire-kpi-card danger ${statusFilter === 'ACTIVE' ? 'active-filter' : ''}`}
          onClick={() => setStatusFilter('ACTIVE')}
        >
          <span className="kpi-num">{activeCount}</span>
          <span className="kpi-label">Feux Actifs</span>
        </div>

        <div
          className={`fire-kpi-card amber ${statusFilter === 'PENDING_VERIFICATION' ? 'active-filter' : ''}`}
          onClick={() => setStatusFilter('PENDING_VERIFICATION')}
        >
          <span className="kpi-num">{pendingCount}</span>
          <span className="kpi-label">À Valider</span>
        </div>

        <div
          className={`fire-kpi-card green ${statusFilter === 'CONTAINED' ? 'active-filter' : ''}`}
          onClick={() => setStatusFilter('CONTAINED')}
        >
          <span className="kpi-num">{containedCount}</span>
          <span className="kpi-label">Maîtrisés</span>
        </div>

        <div
          className={`fire-kpi-card gray ${statusFilter === 'DISMISSED' ? 'active-filter' : ''}`}
          onClick={() => setStatusFilter('DISMISSED')}
        >
          <span className="kpi-num">{dismissedCount}</span>
          <span className="kpi-label">Rejets / Faux Positifs</span>
        </div>
      </div>

      {/* Search & Team Filter Bar */}
      <div className="fire-filters-bar">
        <div className="search-input-wrap">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            className="fire-search-input"
            placeholder="Rechercher par ID (#27), drone (DRONE-01), équipe..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="btn-clear-search" onClick={() => setSearchQuery('')}>
              ×
            </button>
          )}
        </div>

        <div className="team-filter-wrap">
          <Users size={15} className="team-icon" />
          <select
            className="team-filter-select"
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
          >
            <option value="ALL">Toutes les équipes</option>
            <option value="UNASSIGNED">Non assigné (à déployer)</option>
            {TEAMS.map((t) => (
              <option key={t.id} value={t.name}>
                {t.icon} {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Fire List Cards */}
      <div className="fire-card-list">
        {filteredIncidents.length === 0 ? (
          <div className="empty-fires-placeholder">
            <AlertTriangle size={32} className="empty-icon" />
            <h4>Aucun feu ne correspond à ces critères</h4>
            <p>Ajustez les filtres ou réinitialisez la recherche pour afficher les feux.</p>
            <button
              className="btn btn-secondary mt-3"
              onClick={() => {
                setStatusFilter('ALL');
                setTeamFilter('ALL');
                setSearchQuery('');
              }}
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          filteredIncidents.map((inc) => {
            const isSelected = selectedIncident?.id === inc.id;
            const currentTeam = assignedTeams[inc.id];

            return (
              <div
                key={inc.id}
                className={`fire-item-card ${isSelected ? 'fire-card-selected' : ''} status-border-${inc.status.toLowerCase()}`}
              >
                {/* Fire Image & Meta Top */}
                <div className="fire-item-header">
                  <div className="fire-thumb-box">
                    <img
                      src={inc.snapshotUrl}
                      alt={`Feu #${inc.id}`}
                      className="fire-thumb"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'http://localhost:8080/snapshots/demo-fire.jpg';
                      }}
                    />
                    <span className={`fire-severity-badge severity-${inc.severity.toLowerCase()}`}>
                      {inc.severity}
                    </span>
                  </div>

                  <div className="fire-core-info">
                    <div className="fire-title-row">
                      <span className="fire-id-tag">Feu #{inc.id}</span>
                      <span className={`status-pill pill-${inc.status.toLowerCase()}`}>
                        {inc.status}
                      </span>
                    </div>

                    <div className="fire-meta-details">
                      <div className="fire-meta-line">
                        <MapPin size={13} className="text-muted" />
                        <span>{inc.lat.toFixed(4)}°N, {inc.lon.toFixed(4)}°E</span>
                      </div>
                      <div className="fire-meta-line">
                        <span className="font-mono text-blue">{inc.droneId}</span>
                        <span className="meta-sep">•</span>
                        <span>Confiance : <strong>{(inc.confidence * 100).toFixed(0)}%</strong></span>
                      </div>
                      <div className="fire-meta-line text-muted">
                        Détecté : {new Date(inc.createdAt).toLocaleTimeString('fr-DZ')}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Team Assignment Row */}
                <div className="fire-team-assignment-block">
                  <div className="team-assign-label">
                    <Users size={13} />
                    <span>Équipe Déployée :</span>
                  </div>
                  <select
                    className="fire-team-select"
                    value={currentTeam || ''}
                    onChange={(e) => onAssignTeam(inc.id, e.target.value)}
                  >
                    <option value="">-- Assigner une équipe d'intervention --</option>
                    {TEAMS.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.icon} {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Actions Toolbar */}
                <div className="fire-card-actions">
                  <div className="actions-left">
                    <button
                      className="btn-card-action inspect-action"
                      onClick={() => onInspectIncident(inc)}
                      title="Inspecter la fiche complète et les alertes Tajmaât"
                    >
                      <Eye size={14} />
                      <span>Inspecter</span>
                    </button>

                    <button
                      className="btn-card-action locate-action"
                      onClick={() => {
                        onSelectIncident(inc);
                        onNavigateToMap?.();
                      }}
                      title="Localiser et zoomer sur la carte"
                    >
                      <Crosshair size={14} />
                      <span>Carte</span>
                    </button>
                  </div>

                  <div className="actions-right">
                    {/* Keep / Confirm fire */}
                    {inc.status === 'PENDING_VERIFICATION' && (
                      <button
                        className="btn-card-action keep-action"
                        onClick={() => onKeepIncident(inc)}
                        title="Garder ce feu et le confirmer comme actif"
                      >
                        <CheckCircle2 size={14} />
                        <span>Garder / Confirmer</span>
                      </button>
                    )}

                    {/* Delete fire (Removes from map to prevent saturation) */}
                    <button
                      className="btn-card-action delete-action"
                      onClick={() => onDeleteIncident(inc.id)}
                      title="Supprimer ce feu de la carte et du système (Désaturation)"
                    >
                      <Trash2 size={14} />
                      <span>Supprimer</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
