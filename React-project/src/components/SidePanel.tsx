import React, { useState } from 'react';
import { Trash2, CheckCircle2, Eye, MapPin, Users, Flame } from 'lucide-react';
import type { EventLogItem, Incident } from '../types';

interface SidePanelProps {
  events: EventLogItem[];
  onClearEvents: () => void;
  onSelectEvent?: (event: EventLogItem) => void;
  incidents?: Incident[];
  selectedIncident?: Incident | null;
  onSelectIncident?: (incident: Incident) => void;
  onInspectIncident?: (incident: Incident) => void;
  onDeleteIncident?: (id: number) => void;
  onKeepIncident?: (incident: Incident) => void;
  onAssignTeam?: (incidentId: number, teamName: string) => void;
  assignedTeams?: Record<number, string>;
}

// Target / Crosshair corner markers (CIBLE ASSET) from Figma
const TargetCorners: React.FC = () => (
  <>
    <div className="cible-corner cible-top-left">
      <span className="cible-arm-h" />
      <span className="cible-arm-v" />
    </div>
    <div className="cible-corner cible-top-right">
      <span className="cible-arm-h" />
      <span className="cible-arm-v" />
    </div>
    <div className="cible-corner cible-bottom-left">
      <span className="cible-arm-h" />
      <span className="cible-arm-v" />
    </div>
    <div className="cible-corner cible-bottom-right">
      <span className="cible-arm-h" />
      <span className="cible-arm-v" />
    </div>
  </>
);

const TEAMS_LIST = [
  'Protection Civile (Sapeurs-Pompiers)',
  'Comité Tajmaât (Chefs de Village)',
  'Brigade Bénévoles Touiza',
  'Club Écologique & Reboisement',
  'Équipe Télépilotes Surveillance',
];

export const SidePanel: React.FC<SidePanelProps> = ({
  events,
  onClearEvents,
  onSelectEvent,
  incidents = [],
  selectedIncident,
  onSelectIncident,
  onInspectIncident,
  onDeleteIncident,
  onKeepIncident,
  onAssignTeam,
  assignedTeams = {},
}) => {
  const [streamError, setStreamError] = useState(false);
  const [activeTab, setActiveTab] = useState<'video' | 'feed' | 'fires'>('video');
  const AI_PORT = '8001';

  return (
    <div className="tactical-side-panel">
      <TargetCorners />

      {/* Tabs */}
      <div className="side-tabs">
        <button
          className={`side-tab ${activeTab === 'video' ? 'active' : ''}`}
          onClick={() => setActiveTab('video')}
        >
          <span className="tab-live-dot" />
          <span>Flux (:8001)</span>
        </button>
        <button
          className={`side-tab ${activeTab === 'fires' ? 'active' : ''}`}
          onClick={() => setActiveTab('fires')}
        >
          <span>Feux ({incidents.length})</span>
        </button>
        <button
          className={`side-tab ${activeTab === 'feed' ? 'active' : ''}`}
          onClick={() => setActiveTab('feed')}
        >
          <span>Journal</span>
          <span className="tab-count-pill">{events.length}</span>
        </button>
      </div>

      <div className="side-content">
        {activeTab === 'video' ? (
          <div className="video-container">
            <div className="video-header">
              <span className="live-indicator">
                <span className="live-dot" /> EN DIRECT
              </span>
              <span className="stream-source">http://localhost:{AI_PORT}/proxy_feed</span>
            </div>

            {!streamError ? (
              <img
                src={`http://localhost:${AI_PORT}/proxy_feed`}
                alt="Flux Vidéo Drone Surveillance"
                className="live-video-stream"
                onError={() => setStreamError(true)}
              />
            ) : (
              <div className="video-fallback">
                <span className="fallback-reticle">⌖</span>
                <h4>Flux Caméra en Attente</h4>
                <p>
                  Assurez-vous que le service de flux vidéo est actif sur le port <code>{AI_PORT}</code>.
                </p>
                <div className="fallback-badge">Port {AI_PORT}</div>
                <button
                  className="btn-tactical-cta mt-3"
                  onClick={() => setStreamError(false)}
                >
                  <span>Réessayer la connexion</span>
                </button>
              </div>
            )}
          </div>
        ) : activeTab === 'feed' ? (
          <div className="event-feed-container">
            <div className="feed-header">
              <span>Événements WebSocket en temps réel</span>
              {events.length > 0 && (
                <button className="btn-text-sm" onClick={onClearEvents}>
                  Effacer
                </button>
              )}
            </div>

            <div className="event-list">
              {events.length === 0 ? (
                <div className="empty-feed">Aucun événement reçu pour le moment.</div>
              ) : (
                events.map((evt) => (
                  <div
                    key={evt.id}
                    className={`event-card event-${evt.type} clickable-event`}
                    onClick={() => onSelectEvent?.(evt)}
                    title="Cliquer pour afficher la fiche de cet incident"
                  >
                    <div className="event-card-header">
                      <span className="event-time">{evt.time}</span>
                      <span className="event-badge">{evt.type}</span>
                    </div>
                    <div className="event-text">{evt.text}</div>
                    <div className="event-card-footer">
                      <span className="event-hint">Afficher la fiche</span>
                      <span className="event-arrow">↗</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="side-fires-container">
            <div className="side-fires-header">
              <span className="side-fires-count">
                <Flame size={14} className="text-red" />
                <span>{incidents.length} Détections répertoriées</span>
              </span>
            </div>

            <div className="side-fires-list">
              {incidents.length === 0 ? (
                <div className="empty-feed">Aucun feu détecté actuellement.</div>
              ) : (
                incidents.map((inc) => {
                  const isSelected = selectedIncident?.id === inc.id;
                  const currentTeam = assignedTeams[inc.id] || '';

                  return (
                    <div
                      key={inc.id}
                      className={`side-fire-card ${isSelected ? 'side-fire-selected' : ''}`}
                    >
                      <div className="side-fire-top">
                        <div className="side-fire-title">
                          <strong>Feu #{inc.id}</strong>
                          <span className={`status-pill pill-${inc.status.toLowerCase()}`}>
                            {inc.status}
                          </span>
                        </div>
                        <span className="side-fire-conf">{(inc.confidence * 100).toFixed(0)}%</span>
                      </div>

                      <div className="side-fire-meta">
                        <span><MapPin size={11} /> {inc.lat.toFixed(3)}°N, {inc.lon.toFixed(3)}°E</span>
                        <span>{inc.droneId}</span>
                      </div>

                      {/* Team Assignment Mini Row */}
                      <div className="side-fire-team-row">
                        <Users size={11} />
                        <select
                          className="side-team-select"
                          value={currentTeam}
                          onChange={(e) => onAssignTeam?.(inc.id, e.target.value)}
                        >
                          <option value="">-- Assigner équipe --</option>
                          {TEAMS_LIST.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Action buttons */}
                      <div className="side-fire-actions">
                        <button
                          className="btn-side-act"
                          onClick={() => {
                            onSelectIncident?.(inc);
                            onInspectIncident?.(inc);
                          }}
                          title="Inspecter le feu"
                        >
                          <Eye size={12} />
                          <span>Inspecter</span>
                        </button>

                        {inc.status === 'PENDING_VERIFICATION' && (
                          <button
                            className="btn-side-act keep"
                            onClick={() => onKeepIncident?.(inc)}
                            title="Garder ce feu et le confirmer comme actif"
                          >
                            <CheckCircle2 size={12} />
                            <span>Garder</span>
                          </button>
                        )}

                        <button
                          className="btn-side-act delete"
                          onClick={() => onDeleteIncident?.(inc.id)}
                          title="Supprimer ce feu pour libérer la carte"
                        >
                          <Trash2 size={12} />
                          <span>Supprimer</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
