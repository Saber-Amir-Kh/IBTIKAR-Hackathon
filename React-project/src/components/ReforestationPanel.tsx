import React, { useState } from 'react';
import { TreePine, Users, Sprout } from 'lucide-react';
import type { PlantingZone, User } from '../types';
import { registerVolunteer, plantTrees } from '../api';

interface ReforestationPanelProps {
  incidentId: number;
  zones: PlantingZone[];
  selectedZone: PlantingZone | null;
  onSelectZone: (zone: PlantingZone) => void;
  currentUser: User;
  onZoneUpdated: (zone: PlantingZone) => void;
}

export const ReforestationPanel: React.FC<ReforestationPanelProps> = ({
  incidentId,
  zones,
  selectedZone,
  onSelectZone,
  currentUser,
  onZoneUpdated,
}) => {
  const [isBusy, setIsBusy] = useState(false);

  const totalTarget = zones.reduce((sum, z) => sum + z.targetTrees, 0);
  const totalPlanted = zones.reduce((sum, z) => sum + z.treesPlanted, 0);
  const totalVolunteers = zones.reduce((sum, z) => sum + z.registeredVolunteers, 0);
  const globalPct = totalTarget > 0 ? Math.min(100, Math.round((totalPlanted / totalTarget) * 100)) : 0;

  const canPlant = currentUser.role === 'ECO_CLUB' || currentUser.role === 'VOLUNTEER';

  const handleRegister = async (zone: PlantingZone) => {
    try {
      setIsBusy(true);
      const updated = await registerVolunteer(zone.id);
      onZoneUpdated(updated);
    } catch (err: any) {
      alert(err.message || 'Erreur inscription bénévole');
    } finally {
      setIsBusy(false);
    }
  };

  const handlePlant = async (zone: PlantingZone, amount: number) => {
    try {
      setIsBusy(true);
      const updated = await plantTrees(zone.id, amount);
      onZoneUpdated(updated);
    } catch (err: any) {
      alert(err.message || 'Erreur enregistrement plantation');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="reforestation-container">
      <div className="reforestation-header">
        <div>
          <h3>Planificateur de Reboisement Post-Incendie (Incident #{incidentId})</h3>
          <p className="subtitle">
            Restauration écologique parcellisée des massifs brûlés — Mobilisation des Clubs Éco et comités locaux
          </p>
        </div>
      </div>

      {/* Global Campaign Progress Card */}
      <div className="campaign-summary-card">
        <div className="summary-metric">
          <div className="metric-icon metric-green"><TreePine size={26} /></div>
          <div>
            <div className="metric-val">{totalPlanted.toLocaleString()} / {totalTarget.toLocaleString()}</div>
            <div className="metric-lbl">Arbres indigènes plantés</div>
          </div>
        </div>

        <div className="summary-metric">
          <div className="metric-icon metric-blue"><Users size={26} /></div>
          <div>
            <div className="metric-val">{totalVolunteers}</div>
            <div className="metric-lbl">Bénévoles mobilisés</div>
          </div>
        </div>

        <div className="summary-progress">
          <div className="summary-pct-label">
            <span>Progression globale du massif</span>
            <span className="font-bold text-green">{globalPct}% Reboisé</span>
          </div>
          <div className="progress-bar progress-bar-lg">
            <div className="progress-fill fill-green" style={{ width: `${globalPct}%` }}></div>
          </div>
        </div>
      </div>

      {/* Zones Sectors List */}
      <div className="zones-list-header">
        <h4>Parcelles et Secteurs d'Intervention ({zones.length} Parcelles cartographiées)</h4>
        <span className="hint-text">Cliquez sur une parcelle pour la centrer sur la carte</span>
      </div>

      <div className="zones-grid">
        {zones.map((zone) => {
          const zonePct = zone.targetTrees > 0 ? Math.min(100, Math.round((zone.treesPlanted / zone.targetTrees) * 100)) : 0;
          const isSelected = selectedZone?.id === zone.id;

          return (
            <div
              key={zone.id}
              className={`zone-card ${isSelected ? 'zone-selected' : ''}`}
              onClick={() => onSelectZone(zone)}
            >
              <div className="zone-card-top">
                <div className="zone-name-wrap">
                  <TreePine size={18} className={zonePct >= 100 ? 'text-green' : 'text-amber'} />
                  <span className="zone-name">{zone.name}</span>
                </div>
                <span className={`zone-status-badge ${zone.status.toLowerCase()}`}>
                  {zone.status === 'DONE' ? 'TERMINÉ' : (zone.status === 'IN_PROGRESS' ? 'EN COURS' : 'PLANIFIÉ')}
                </span>
              </div>

              {/* Progress bar with color shift preview */}
              <div className="zone-progress-wrap">
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${zonePct}%`,
                      backgroundColor: zonePct >= 100 ? '#16a34a' : (zonePct >= 40 ? '#22c55e' : '#ca8a04'),
                    }}
                  ></div>
                </div>
                <div className="zone-stats">
                  <span>{zone.treesPlanted} / {zone.targetTrees} arbres</span>
                  <span className="font-bold">{zonePct}%</span>
                  <span><Users size={12} /> {zone.registeredVolunteers} inscrits</span>
                </div>
              </div>

              {/* Action Buttons for Volunteer / Eco-Club */}
              <div className="zone-actions" onClick={(e) => e.stopPropagation()}>
                {canPlant ? (
                  <div className="zone-plant-controls">
                    <button
                      className="btn btn-outline-primary btn-xs"
                      onClick={() => handleRegister(zone)}
                      disabled={isBusy}
                      title="S'inscrire comme bénévole pour cette parcelle"
                    >
                      <Users size={13} /> S'inscrire
                    </button>

                    <div className="plant-btn-group">
                      <button
                        className="btn btn-success btn-xs"
                        onClick={() => handlePlant(zone, 10)}
                        disabled={isBusy || zone.status === 'DONE'}
                      >
                        <Sprout size={13} /> +10
                      </button>
                      <button
                        className="btn btn-success btn-xs"
                        onClick={() => handlePlant(zone, 25)}
                        disabled={isBusy || zone.status === 'DONE'}
                      >
                        +25
                      </button>
                      <button
                        className="btn btn-success btn-xs"
                        onClick={() => handlePlant(zone, 50)}
                        disabled={isBusy || zone.status === 'DONE'}
                      >
                        +50
                      </button>
                    </div>
                  </div>
                ) : (
                  <span className="hint-text text-xs">Passez en Club Éco ou Bénévole pour enregistrer des plantations</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
