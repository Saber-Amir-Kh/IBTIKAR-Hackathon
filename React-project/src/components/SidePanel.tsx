import React, { useState } from 'react';
import { Video, Bell, Radio, AlertCircle } from 'lucide-react';
import type { EventLogItem } from '../types';

interface SidePanelProps {
  events: EventLogItem[];
  onClearEvents: () => void;
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

export const SidePanel: React.FC<SidePanelProps> = ({ events, onClearEvents }) => {
  const [streamError, setStreamError] = useState(false);
  const [activeTab, setActiveTab] = useState<'video' | 'feed'>('video');
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
          <Video size={15} />
          <span>Flux Vidéo Direct (:8001)</span>
        </button>
        <button
          className={`side-tab ${activeTab === 'feed' ? 'active' : ''}`}
          onClick={() => setActiveTab('feed')}
        >
          <Bell size={15} />
          <span>Journal Événements ({events.length})</span>
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
                <AlertCircle size={38} className="icon-muted" />
                <h4>Flux Caméra IA en Attente</h4>
                <p>
                  Assurez-vous que <code>python main.py</code> est lancé dans le dossier <code>Python</code>.
                </p>
                <div className="fallback-badge">Port {AI_PORT}</div>
                <button
                  className="btn-tactical-cta mt-3"
                  onClick={() => setStreamError(false)}
                >
                  <Radio size={14} />
                  <span>Réessayer la connexion</span>
                </button>
              </div>
            )}
          </div>
        ) : (
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
                  <div key={evt.id} className={`event-card event-${evt.type}`}>
                    <div className="event-time">{evt.time}</div>
                    <div className="event-badge">{evt.type}</div>
                    <div className="event-text">{evt.text}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
