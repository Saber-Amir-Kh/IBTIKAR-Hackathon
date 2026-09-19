import React from 'react';
import { Flame, Radio, RefreshCw, Zap } from 'lucide-react';
import type { User } from '../types';

interface HeaderProps {
  currentUser: User;
  users: User[];
  onSelectUser: (user: User) => void;
  wsConnected: boolean;
  onTriggerDemo: () => void;
  onResetDemo: () => void;
  isTriggering: boolean;
  isResetting: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  users,
  onSelectUser,
  wsConnected,
  onTriggerDemo,
  onResetDemo,
  isTriggering,
  isResetting,
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
    <header className="app-header">
      <div className="header-left">
        <div className="brand-logo">
          <Flame className="icon-fire" size={28} />
          <div>
            <h1 className="brand-title">Sentinelle Algérie — Tajmaât Ops</h1>
            <p className="brand-subtitle">Alerte Précoce Feux de Forêt & Mobilisation Communautaire</p>
          </div>
        </div>
      </div>

      <div className="header-center">
        <div className="ws-status">
          <span className={`ws-dot ${wsConnected ? 'connected' : 'disconnected'}`}></span>
          <Radio size={15} />
          <span>{wsConnected ? 'WebSocket Connecté' : 'WebSocket Hors-ligne'}</span>
        </div>
      </div>

      <div className="header-right">
        {/* Role Selector */}
        <div className="role-switcher">
          <span className="role-label">Utilisateur actif :</span>
          <select
            className="user-select"
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
          <span className={`role-badge ${getRoleBadgeColor(currentUser.role)}`}>
            {currentUser.role}
          </span>
        </div>

        {/* Demo Controls */}
        <div className="demo-actions">
          <button
            className="btn btn-warning btn-sm"
            onClick={onTriggerDemo}
            disabled={isTriggering}
            title="Simule une détection IA sans microservice Python"
          >
            <Zap size={15} />
            <span>{isTriggering ? 'Envoi...' : 'Simuler Détection'}</span>
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={onResetDemo}
            disabled={isResetting}
            title="Réinitialise la base de données à l'état propre"
          >
            <RefreshCw size={15} className={isResetting ? 'spin' : ''} />
            <span>{isResetting ? 'Reset...' : 'Réinitialiser'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
