import React from 'react';
import type { Incident, User } from '../types';
import { CustomSelect } from './CustomSelect';

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

  return (
    <header className="tactical-topbar">
      {/* Left: Incident Quick Selector */}
      <div className="topbar-left">
        <div className="incident-selector-wrap">
          <label htmlFor="top-incident-select" className="topbar-label">
            Incident :
          </label>
          {incidents.length > 0 ? (
            <CustomSelect
              size="sm"
              className="topbar-custom-select incident-select"
              value={selectedIncident?.id || ''}
              placeholder="Choisir incident..."
              onChange={(val) => {
                const found = incidents.find((i) => i.id === Number(val));
                if (found) onSelectIncident(found);
              }}
              options={incidents.map((inc) => ({
                value: inc.id,
                label: `#${inc.id} • ${inc.droneId}`,
                badge: inc.severity,
                badgeColor:
                  inc.severity === 'HIGH'
                    ? '#ef4444'
                    : inc.severity === 'MEDIUM'
                    ? '#f59e0b'
                    : '#38bdf8',
                sublabel: `${inc.lat.toFixed(3)}°N, ${inc.lon.toFixed(3)}°E`
              }))}
            />
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
            <span>Inspecter #{selectedIncident.id}</span>
            <span className="inspect-arrow">→</span>
          </button>
        )}
      </div>

      {/* Center: Realtime Telemetry Status */}
      <div className="topbar-center">
        <div className="telemetry-pill">
          <span className="telemetry-live-dot amber" />
          <span>{droneCount} Drones</span>
        </div>

        <div className="ws-indicator-pill">
          <span className={`ws-dot-pulse ${wsConnected ? 'online' : 'offline'}`} />
          <span>{wsConnected ? 'Temps réel' : 'Hors-ligne'}</span>
        </div>
      </div>

      {/* Right: Role Switcher */}
      <div className="topbar-right">
        <div className="role-switcher-wrap">
          <span className="topbar-label">Rôle :</span>
          <CustomSelect
            size="sm"
            className="topbar-custom-select user-select"
            value={currentUser.id}
            onChange={(val) => {
              const selected = users.find((u) => u.id === Number(val));
              if (selected) onSelectUser(selected);
            }}
            options={users.map((u) => ({
              value: u.id,
              label: u.name,
              badge: u.role,
              badgeColor:
                u.role === 'COORDINATOR'
                  ? '#ef4444'
                  : u.role === 'COMMITTEE_HEAD'
                  ? '#f59e0b'
                  : u.role === 'VOLUNTEER'
                  ? '#38bdf8'
                  : '#10b981'
            }))}
          />
          <span className={`role-tag ${getRoleBadgeColor(currentUser.role)}`}>
            {currentUser.role}
          </span>
        </div>
      </div>
    </header>
  );
};
