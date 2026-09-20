import React from 'react';
import type { Incident, User } from '../types';

interface TopBarProps {
  incidents: Incident[];
  selectedIncident: Incident | null;
  onSelectIncident: (incident: Incident) => void;
  onInspectIncident: () => void;
  currentUser: User;
  users: User[];
  onSelectUser: (user: User) => void;
  wsConnected: boolean;
  droneCount?: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  incidents,
  selectedIncident,
  onSelectIncident,
  onInspectIncident,
  currentUser,
  users,
  onSelectUser,
  wsConnected,
  droneCount = 3,
}) => {
  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'COORDINATOR': return 'badge-purple';
      case 'COMMITTEE_HEAD': return 'badge-red';
      case 'VOLUNTEER': return 'badge-blue';
      case 'ECO_CLUB': return 'badge-green';
      default: return 'badge-gray';
    }
  };

  const getRoleLabelFr = (role: string) => {
    switch (role) {
      case 'COORDINATOR': return 'Coordinateur de Crise';
      case 'COMMITTEE_HEAD': return 'Chef Comité Tajmaât';
      case 'VOLUNTEER': return 'Bénévole Communautaire';
      case 'ECO_CLUB': return 'Club Éco & Reboisement';
      default: return role;
    }
  };

  return (
    <header className="tactical-topbar">
      {/* Left: Incident Quick Selector */}
      <div className="topbar-left">
        <div className="incident-selector-wrap">
          <label htmlFor="top-incident-select" className="topbar-label">
            Incident :
          </label>
          {incidents.length > 0 ? (
            <select
              id="top-incident-select"
              className="topbar-select incident-select"
              value={selectedIncident?.id || ''}
              onChange={(e) => {
                const found = incidents.find((i) => i.id === Number(e.target.value));
                if (found) onSelectIncident(found);
              }}
            >
              {incidents.map((inc) => (
                <option key={inc.id} value={inc.id}>
                  #{inc.id} [{inc.status}] — {inc.droneId} ({inc.severity})
                </option>
              ))}
            </select>
          ) : (
            <span className="no-incident-tag">Aucun incident</span>
          )}

          {selectedIncident && (
            <span className={`status-pill pill-${selectedIncident.status.toLowerCase()}`}>
              {selectedIncident.status}
            </span>
          )}
        </div>

        {selectedIncident && (
          <button
            className="btn-inspect-action"
            onClick={onInspectIncident}
            title="Inspecter les détails et valider l'alerte"
          >
            <span>Détails & Actions #{selectedIncident.id}</span>
            <span className="inspect-arrow">→</span>
          </button>
        )}
      </div>

      {/* Center: Realtime Telemetry Status */}
      <div className="topbar-center">
        <div className="telemetry-pill">
          <span className="telemetry-live-dot amber" />
          <span>{droneCount} Drones en Vol</span>
        </div>

        <div className="ws-indicator-pill">
          <span className={`ws-dot-pulse ${wsConnected ? 'online' : 'offline'}`} />
          <span>{wsConnected ? 'Temps Réel Connecté' : 'Hors-ligne'}</span>
        </div>
      </div>

      {/* Right: Role Switcher */}
      <div className="topbar-right">
        <div className="role-switcher-wrap">
          <span className="topbar-label">Rôle :</span>
          <select
            className="topbar-select user-select"
            value={currentUser.id}
            onChange={(e) => {
              const selected = users.find((u) => u.id === Number(e.target.value));
              if (selected) onSelectUser(selected);
            }}
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({getRoleLabelFr(u.role)})
              </option>
            ))}
          </select>
          <span className={`role-tag ${getRoleBadgeColor(currentUser.role)}`}>
            {currentUser.role}
          </span>
        </div>
      </div>
    </header>
  );
};
