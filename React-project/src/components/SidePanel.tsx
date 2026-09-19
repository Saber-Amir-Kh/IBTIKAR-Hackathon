import React, { useState } from 'react';
import { Video, Bell, Radio, AlertCircle } from 'lucide-react';
import type { EventLogItem } from '../types';

interface SidePanelProps {
  events: EventLogItem[];
  onClearEvents: () => void;
}

export const SidePanel: React.FC<SidePanelProps> = ({ events, onClearEvents }) => {
  const [streamError, setStreamError] = useState(false);
  const [activeTab, setActiveTab] = useState<'video' | 'feed'>('video');
  const [aiPort, setAiPort] = useState<string>('8001');

  const handleStreamError = () => {
    if (aiPort === '8001') {
      // Try fallback port 8000
      setAiPort('8000');
    } else {
      setStreamError(true);
    }
  };

  return (
    <div className="side-panel">
      <div className="side-tabs">
        <button
          className={`side-tab ${activeTab === 'video' ? 'active' : ''}`}
          onClick={() => setActiveTab('video')}
        >
          <Video size={16} />
          <span>Flux Vidéo Direct (Port {aiPort})</span>
        </button>
        <button
          className={`side-tab ${activeTab === 'feed' ? 'active' : ''}`}
          onClick={() => setActiveTab('feed')}
        >
          <Bell size={16} />
          <span>Journal Événements ({events.length})</span>
        </button>
      </div>

      <div className="side-content">
        {activeTab === 'video' ? (
          <div className="video-container">
            <div className="video-header">
              <span className="live-indicator">
                <span className="live-dot"></span> EN DIRECT
              </span>
              <span className="stream-source">http://localhost:{aiPort}/proxy_feed</span>
            </div>

            {!streamError ? (
              <img
                src={`http://localhost:${aiPort}/proxy_feed`}
                alt="Flux Vidéo Drone Surveillance"
                className="live-video-stream"
                onError={handleStreamError}
              />
            ) : (
              <div className="video-fallback">
                <AlertCircle size={40} className="icon-muted" />
                <h4>Flux Caméra IA en Attente</h4>
                <p>
                  Assurez-vous que <code>python main.py</code> est lancé dans le dossier <code>Python</code>.
                </p>
                <div className="fallback-badge">Port {aiPort}</div>
                <button
                  className="btn btn-secondary btn-sm mt-2"
                  onClick={() => {
                    setStreamError(false);
                    setAiPort('8001');
                  }}
                >
                  <Radio size={14} /> Réessayer la connexion
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
