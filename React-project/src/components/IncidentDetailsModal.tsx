import React, { useState, useEffect } from 'react';
import { X, CheckCircle, Copy, Shield, MapPin, Calendar, Check } from 'lucide-react';
import type { Incident, User, AlertResponse, IncidentStatus } from '../types';
import { getAlert, updateIncidentStatus } from '../api';

interface IncidentDetailsModalProps {
  incident: Incident | null;
  currentUser: User;
  onClose: () => void;
  onIncidentUpdated: (updated: Incident) => void;
}

export const IncidentDetailsModal: React.FC<IncidentDetailsModalProps> = ({
  incident,
  currentUser,
  onClose,
  onIncidentUpdated,
}) => {
  const [alertData, setAlertData] = useState<AlertResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!incident) return;
    if (incident.status === 'ACTIVE' || incident.status === 'CONTAINED' || incident.status === 'REFORESTATION') {
      loadAlert(incident.id);
    } else {
      setAlertData(null);
    }
  }, [incident]);

  const loadAlert = async (id: number) => {
    try {
      const data = await getAlert(id);
      setAlertData(data);
    } catch (err: any) {
      console.error('Failed to load alert:', err);
    }
  };

  if (!incident) return null;

  const handleStatusChange = async (newStatus: IncidentStatus) => {
    try {
      setIsProcessing(true);
      setActionError(null);
      const updated = await updateIncidentStatus(incident.id, newStatus, `${currentUser.name} (${currentUser.role})`);
      onIncidentUpdated(updated);
      if (newStatus === 'ACTIVE') {
        loadAlert(incident.id);
      }
    } catch (err: any) {
      setActionError(err.message || 'Erreur lors du changement de statut');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyAlert = () => {
    if (!alertData) return;
    const textToCopy = `${alertData.rawBroadcastFr}\n\n====================\n\n${alertData.rawBroadcastAr}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const isCommitteeHead = currentUser.role === 'COMMITTEE_HEAD';
  const isCoordinator = currentUser.role === 'COORDINATOR';

  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <h3 className="modal-title">Fiche Incident #{incident.id}</h3>
            <span className={`status-pill status-${incident.status.toLowerCase()}`}>
              {incident.status}
            </span>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {actionError && <div className="alert-box alert-error">{actionError}</div>}

          {/* Top Info Grid */}
          <div className="incident-grid">
            <div className="snapshot-box">
              <img
                src={incident.snapshotUrl}
                alt="Capture AI Wildfire"
                className="snapshot-img"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'http://localhost:8080/snapshots/demo-fire.jpg';
                }}
              />
              <div className="snapshot-caption">
                Capture de détection — {incident.label.toUpperCase()} ({(incident.confidence * 100).toFixed(1)}%)
              </div>
            </div>

            <div className="meta-box">
              <h4>Métadonnées Détection</h4>
              <div className="meta-row">
                <span className="meta-label"><MapPin size={15} /> Coordonnées :</span>
                <span className="meta-val">{incident.lat.toFixed(5)}°N, {incident.lon.toFixed(5)}°E</span>
              </div>
              <div className="meta-row">
                <span className="meta-label">Drone Source :</span>
                <span className="meta-val font-mono">{incident.droneId}</span>
              </div>
              <div className="meta-row">
                <span className="meta-label">Niveau de Gravité :</span>
                <span className={`severity-tag severity-${incident.severity.toLowerCase()}`}>
                  {incident.severity}
                </span>
              </div>
              <div className="meta-row">
                <span className="meta-label"><Calendar size={15} /> Détecté le :</span>
                <span className="meta-val">{new Date(incident.createdAt).toLocaleString('fr-DZ')}</span>
              </div>
              {incident.verifiedBy && (
                <div className="meta-row">
                  <span className="meta-label">Vérifié par :</span>
                  <span className="meta-val">{incident.verifiedBy}</span>
                </div>
              )}

              {/* Committee Head Action Buttons */}
              {incident.status === 'PENDING_VERIFICATION' && (
                <div className="verification-actions">
                  <p className="notice-text">
                    {isCommitteeHead
                      ? 'Action requise : Confirmer ou rejeter la détection transmise par le drone.'
                      : 'Réservé au Chef du Comité Tajmaât (Amine Ait-Ahmed) pour validation terrain.'}
                  </p>
                  <div className="btn-group">
                    <button
                      className="btn btn-danger"
                      onClick={() => handleStatusChange('ACTIVE')}
                      disabled={!isCommitteeHead || isProcessing}
                    >
                      <CheckCircle size={16} />
                      <span>Confirmer l'incendie</span>
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleStatusChange('DISMISSED')}
                      disabled={!isCommitteeHead || isProcessing}
                    >
                      <X size={16} />
                      <span>Rejeter (brûlage contrôlé)</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Active Incident Controls */}
              {incident.status === 'ACTIVE' && (
                <div className="active-incident-actions mt-3">
                  <p className="notice-text">
                    Le feu est actuellement actif. Une fois le périmètre sécurisé, marquez l'incident comme maîtrisé.
                  </p>
                  {(isCoordinator || isCommitteeHead) && (
                    <button
                      className="btn btn-warning"
                      onClick={() => handleStatusChange('CONTAINED')}
                      disabled={isProcessing}
                    >
                      <Shield size={16} />
                      <span>Marquer l'incendie maîtrisé (Contenu)</span>
                    </button>
                  )}
                </div>
              )}

              {/* Contained Incident Controls */}
              {incident.status === 'CONTAINED' && (
                <div className="contained-incident-actions mt-3">
                  <p className="notice-text text-green">
                    Périmètre sous contrôle. Les parcelles de reboisement ont été générées automatiquement.
                  </p>
                  <button
                    className="btn btn-success"
                    onClick={() => handleStatusChange('REFORESTATION')}
                    disabled={isProcessing}
                  >
                    <span>Lancer officiellement la campagne de reboisement</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Bilingual Alert Payload Section */}
          {alertData && (
            <div className="alert-payload-card">
              <div className="alert-payload-header">
                <div className="alert-titles">
                  <div className="alert-fr-title">🚨 {alertData.titleFr}</div>
                  <div className="alert-ar-title">🚨 {alertData.titleAr}</div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={handleCopyAlert}>
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                  <span>{copied ? 'Copié !' : 'Copier l\'alerte Tajmaât'}</span>
                </button>
              </div>

              <div className="bilingual-grid">
                <div className="lang-col fr-col">
                  <h5>Directives de Sécurité (Français) — {alertData.committeeFr}</h5>
                  <ul className="safe-rules-list">
                    {alertData.safeObjectivesFr.map((obj, i) => (
                      <li key={i}>{obj}</li>
                    ))}
                  </ul>
                </div>

                <div className="lang-col ar-col" dir="rtl">
                  <h5>تعليمات السلامة الميدانية (العربية) — {alertData.committeeAr}</h5>
                  <ul className="safe-rules-list">
                    {alertData.safeObjectivesAr.map((obj, i) => (
                      <li key={i}>{obj}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
