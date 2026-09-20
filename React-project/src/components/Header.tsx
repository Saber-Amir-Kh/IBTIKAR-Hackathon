import React from 'react';
import { Flame, Radio, Zap } from 'lucide-react';
import type { User } from '../types';

interface HeaderProps {
  currentUser: User;
  users: User[];
  onSelectUser: (user: User) => void;
  wsConnected: boolean;
  onToggleDemoTools: () => void;
  showDemoTools: boolean;
  onBackToLanding?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  users,
  onSelectUser,
  wsConnected,
  onToggleDemoTools,
  showDemoTools,
  onBackToLanding,
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
          <Flame className="icon-fire" size={26} />
          <div>
            <h1 className="brand-title">Sentinelle Algérie — Tajmaât Ops</h1>
            <p className="brand-subtitle">Plateforme d'Alerte Précoce & Mobilisation Communautaire</p>
          </div>
        </div>
      </div>

      <div className="header-center">
        <div className="ws-status">
          <span className={`ws-dot ${wsConnected ? 'connected' : 'disconnected'}`}></span>
          <Radio size={14} />
          <span>{wsConnected ? 'Temps Réel Connecté' : 'Hors-ligne'}</span>
        </div>
      </div>

      <div className="header-right">
        {/* Role Selector */}
        <div className="role-switcher">
          <span className="role-label">Rôle :</span>
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

        {/* Demo Tools Toggle (Unobtrusive) */}
        <button
          className={`btn btn-sm ${showDemoTools ? 'btn-primary' : 'btn-secondary'}`}
          onClick={onToggleDemoTools}
          title="Ouvrir le panneau d'outils de simulation de test"
        >
          <Zap size={14} />
          <span>{showDemoTools ? 'Masquer Outils Démo' : 'Outils Démo'}</span>
        </button>

        {/* Return to Showcase / Landing Page */}
        {onBackToLanding && (
          <button
            className="btn btn-sm btn-outline-secondary"
            onClick={onBackToLanding}
            title="Retourner sur la page de présentation (Landing Page)"
          >
            <span>Accueil Vitrine</span>
          </button>
        )}
      </div>
    </header>
  );
};
