import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { LiveMap } from './components/LiveMap';
import { SidePanel } from './components/SidePanel';
import { IncidentDetailsModal } from './components/IncidentDetailsModal';
import { MutualAidBoard } from './components/MutualAidBoard';
import { ReforestationPanel } from './components/ReforestationPanel';
import type {
  User,
  Incident,
  DroneTelemetry,
  Need,
  PlantingZone,
  EventLogItem,
  WsMessage,
} from './types';
import {
  getUsers,
  getIncidents,
  getTelemetry,
  getNeeds,
  getZones,
  triggerDemoDetection,
  resetDemo,
} from './api';
import { Package, TreePine, Map as MapIcon, Zap, X } from 'lucide-react';
import './App.css';

const DEFAULT_USERS: User[] = [
  { id: 1, name: 'Karim Haddad', role: 'COORDINATOR' },
  { id: 2, name: 'Amine Ait-Ahmed', role: 'COMMITTEE_HEAD' },
  { id: 3, name: 'Yasmine Mansouri', role: 'VOLUNTEER' },
  { id: 4, name: 'Tarek Benali', role: 'ECO_CLUB' },
];

export const App: React.FC = () => {
  const [users, setUsers] = useState<User[]>(DEFAULT_USERS);
  const [currentUser, setCurrentUser] = useState<User>(DEFAULT_USERS[0]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [drones, setDrones] = useState<DroneTelemetry[]>([]);
  const [needs, setNeeds] = useState<Need[]>([]);
  const [zones, setZones] = useState<PlantingZone[]>([]);
  const [selectedZone, setSelectedZone] = useState<PlantingZone | null>(null);
  const [events, setEvents] = useState<EventLogItem[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [activeViewTab, setActiveViewTab] = useState<'map' | 'incident' | 'aid' | 'reforest'>('map');
  const [isTriggering, setIsTriggering] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [showDemoTools, setShowDemoTools] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  const addEvent = useCallback((type: string, text: string) => {
    const item: EventLogItem = {
      id: Math.random().toString(36).substring(2, 9),
      time: new Date().toLocaleTimeString('fr-DZ'),
      type,
      text,
    };
    setEvents((prev) => [item, ...prev.slice(0, 49)]);
  }, []);

  // Fetch initial data
  const loadInitialData = useCallback(async () => {
    try {
      const fetchedUsers = await getUsers().catch(() => DEFAULT_USERS);
      if (fetchedUsers.length > 0) {
        setUsers(fetchedUsers);
        // keep current user role if matches or default
        setCurrentUser((prev) => fetchedUsers.find((u) => u.id === prev.id) || fetchedUsers[0]);
      }

      const fetchedIncidents = await getIncidents();
      setIncidents(fetchedIncidents);

      if (fetchedIncidents.length > 0) {
        // Select the active or latest incident
        const toSelect = fetchedIncidents[0];
        setSelectedIncident(toSelect);
        loadIncidentSubData(toSelect.id);
      }

      const fetchedTelemetry = await getTelemetry();
      setDrones(fetchedTelemetry);
    } catch (err) {
      console.error('Initial data loading error:', err);
    }
  }, []);

  const loadIncidentSubData = async (incidentId: number) => {
    try {
      const [fetchedNeeds, fetchedZones] = await Promise.all([
        getNeeds(incidentId).catch(() => []),
        getZones(incidentId).catch(() => []),
      ]);
      setNeeds(fetchedNeeds);
      setZones(fetchedZones);
      if (fetchedZones.length > 0) {
        setSelectedZone(fetchedZones[0]);
      } else {
        setSelectedZone(null);
      }
    } catch (err) {
      console.error('Failed to load incident sub data:', err);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Telemetry Polling (every 2s)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const data = await getTelemetry();
        setDrones(data);
      } catch (err) {
        // quiet error on polling
      }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Persistent Plain WebSocket Setup
  useEffect(() => {
    let reconnectTimeout: any;

    const connectWs = () => {
      try {
        const ws = new WebSocket('ws://localhost:8080/ws');

        ws.onopen = () => {
          setWsConnected(true);
          addEvent('SYSTEM', 'Connexion temps-réel WebSocket établie avec le serveur Spring.');
        };

        ws.onmessage = (msgEvent) => {
          try {
            const data: WsMessage = JSON.parse(msgEvent.data);
            handleWsMessage(data);
          } catch (e) {
            console.error('Error parsing WS message:', e);
          }
        };

        ws.onclose = () => {
          setWsConnected(false);
          reconnectTimeout = setTimeout(connectWs, 3000);
        };

        ws.onerror = () => {
          ws.close();
        };

        wsRef.current = ws;
      } catch (err) {
        reconnectTimeout = setTimeout(connectWs, 3000);
      }
    };

    connectWs();

    return () => {
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (wsRef.current) wsRef.current.close();
    };
  }, [addEvent]);

  // Handle WS Events
  const handleWsMessage = (msg: WsMessage) => {
    switch (msg.type) {
      case 'detection': {
        const newInc: Incident = msg.payload;
        setIncidents((prev) => [newInc, ...prev.filter((i) => i.id !== newInc.id)]);
        setSelectedIncident(newInc);
        loadIncidentSubData(newInc.id);
        setInspectModalOpen(true);
        addEvent('DETECTION', `Alerte départ de feu détecté par ${newInc.droneId} (Confiance: ${(newInc.confidence * 100).toFixed(0)}%) !`);
        break;
      }
      case 'incident_updated': {
        const updated: Incident = msg.payload;
        setIncidents((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
        if (selectedIncident?.id === updated.id) {
          setSelectedIncident(updated);
          loadIncidentSubData(updated.id);
        }
        addEvent('INCIDENT', `Incident #${updated.id} mis à jour : Statut -> ${updated.status}`);
        break;
      }
      case 'need_posted': {
        const need: Need = msg.payload;
        if (selectedIncident?.id === need.incidentId) {
          setNeeds((prev) => [...prev.filter((n) => n.id !== need.id), need]);
        }
        addEvent('BESOIN', `Nouveau besoin publié : ${need.title} (${need.quantity})`);
        break;
      }
      case 'need_claimed': {
        const need: Need = msg.payload;
        if (selectedIncident?.id === need.incidentId) {
          setNeeds((prev) => prev.map((n) => (n.id === need.id ? need : n)));
        }
        addEvent('RÉCLAMATION', `Besoin satisfait : ${need.title} (${need.quantityClaimed}/${need.quantity})`);
        break;
      }
      case 'zone_updated': {
        const zone: PlantingZone = msg.payload;
        if (selectedIncident?.id === zone.incidentId) {
          setZones((prev) => prev.map((z) => (z.id === zone.id ? zone : z)));
          if (selectedZone?.id === zone.id) {
            setSelectedZone(zone);
          }
        }
        addEvent('REBOISEMENT', `Parcelle mise à jour : ${zone.name} (${zone.treesPlanted}/${zone.targetTrees} arbres)`);
        break;
      }
      case 'demo_reset': {
        loadInitialData();
        addEvent('DEMO', 'La base de données a été réinitialisée avec succès (feux de test supprimés).');
        break;
      }
      default:
        console.log('Unhandled WS message:', msg);
    }
  };

  // Demo Actions
  const handleTriggerDemo = async () => {
    try {
      setIsTriggering(true);
      const inc = await triggerDemoDetection();
      addEvent('DEMO', `Détection factice générée pour l'incident #${inc.id}`);
    } catch (err: any) {
      alert('Erreur simulation détection : ' + err.message);
    } finally {
      setIsTriggering(false);
    }
  };

  const handleResetDemo = async () => {
    if (!window.confirm('Voulez-vous réinitialiser toutes les données à l\'état initial de démo ?')) return;
    try {
      setIsResetting(true);
      await resetDemo();
      await loadInitialData();
      addEvent('DEMO', 'Données réinitialisées avec succès (4 utilisateurs, 1 incident contenu, 40% reboisé).');
    } catch (err: any) {
      alert('Erreur réinitialisation : ' + err.message);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="app-container">
      <Header
        currentUser={currentUser}
        users={users}
        onSelectUser={setCurrentUser}
        wsConnected={wsConnected}
        onToggleDemoTools={() => setShowDemoTools((prev) => !prev)}
        showDemoTools={showDemoTools}
      />

      {/* Incident Quick Selector Bar (Clean & Compact) */}
      <div className="incident-selector-bar">
        <div className="selector-group">
          <span className="selector-label">Incident sélectionné :</span>
          {incidents.length > 0 ? (
            <select
              className="incident-dropdown"
              value={selectedIncident?.id || ''}
              onChange={(e) => {
                const inc = incidents.find((i) => i.id === Number(e.target.value));
                if (inc) {
                  setSelectedIncident(inc);
                  loadIncidentSubData(inc.id);
                }
              }}
            >
              {incidents.map((inc) => (
                <option key={inc.id} value={inc.id}>
                  #{inc.id} [{inc.status}] — {inc.droneId} ({inc.severity})
                </option>
              ))}
            </select>
          ) : (
            <span className="text-muted text-sm">Aucun incident enregistré</span>
          )}

          {selectedIncident && (
            <span className={`status-badge-compact pill-${selectedIncident.status.toLowerCase()}`}>
              {selectedIncident.status}
            </span>
          )}
        </div>

        <div className="selector-actions">
          {selectedIncident && (
            <button
              className="btn btn-outline-primary btn-sm"
              onClick={() => setInspectModalOpen(true)}
            >
              Inspecter l'incident #{selectedIncident.id}
            </button>
          )}
          <span className="incidents-total-badge">
            {incidents.length} incident{incidents.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Main Workspace Navigation Tabs */}
      <div className="nav-tabs-bar">
        <button
          className={`nav-tab-btn ${activeViewTab === 'map' ? 'active' : ''}`}
          onClick={() => setActiveViewTab('map')}
        >
          <MapIcon size={16} />
          <span>Carte Opérationnelle & Surveillance</span>
        </button>

        <button
          className={`nav-tab-btn ${activeViewTab === 'aid' ? 'active' : ''}`}
          onClick={() => setActiveViewTab('aid')}
        >
          <Package size={16} />
          <span>Entraide Communautaire ({needs.length})</span>
        </button>

        <button
          className={`nav-tab-btn ${activeViewTab === 'reforest' ? 'active' : ''}`}
          onClick={() => setActiveViewTab('reforest')}
        >
          <TreePine size={16} />
          <span>Reboisement & Parcelles ({zones.length})</span>
        </button>
      </div>

      {/* Active View Container */}
      <main className="main-content-view">
        {activeViewTab === 'map' && (
          <div className="map-view-layout">
            <div className="map-column">
              <LiveMap
                incidents={incidents}
                drones={drones}
                selectedIncident={selectedIncident}
                onSelectIncident={(inc) => {
                  setSelectedIncident(inc);
                  loadIncidentSubData(inc.id);
                  setInspectModalOpen(true);
                }}
                zones={zones}
                selectedZone={selectedZone}
                onSelectZone={(z) => {
                  setSelectedZone(z);
                  setActiveViewTab('reforest');
                }}
              />
            </div>
            <div className="side-column">
              <SidePanel events={events} onClearEvents={() => setEvents([])} />
            </div>
          </div>
        )}

        {activeViewTab === 'aid' && (
          <div className="subview-layout">
            {selectedIncident ? (
              <MutualAidBoard
                incidentId={selectedIncident.id}
                needs={needs}
                currentUser={currentUser}
                onNeedCreated={(newNeed) => setNeeds((prev) => [...prev, newNeed])}
                onNeedClaimed={(updatedNeed) =>
                  setNeeds((prev) => prev.map((n) => (n.id === updatedNeed.id ? updatedNeed : n)))
                }
              />
            ) : (
              <div className="p-8 text-center text-muted">Veuillez sélectionner un incident.</div>
            )}
          </div>
        )}

        {activeViewTab === 'reforest' && (
          <div className="subview-layout">
            {selectedIncident ? (
              <ReforestationPanel
                incidentId={selectedIncident.id}
                zones={zones}
                selectedZone={selectedZone}
                onSelectZone={setSelectedZone}
                currentUser={currentUser}
                onZoneUpdated={(updatedZone) =>
                  setZones((prev) => prev.map((z) => (z.id === updatedZone.id ? updatedZone : z)))
                }
              />
            ) : (
              <div className="p-8 text-center text-muted">Veuillez sélectionner un incident.</div>
            )}
          </div>
        )}
      </main>

      {/* Incident Details & Verification Modal */}
      {inspectModalOpen && selectedIncident && (
        <IncidentDetailsModal
          incident={selectedIncident}
          currentUser={currentUser}
          onClose={() => setInspectModalOpen(false)}
          onIncidentUpdated={(updated) => {
            setSelectedIncident(updated);
            setIncidents((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
            loadIncidentSubData(updated.id);
          }}
        />
      )}

      {/* Floating Demo Tools Drawer (Simulation Controls) */}
      {showDemoTools && (
        <div className="demo-tools-drawer">
          <div className="demo-tools-header">
            <div className="demo-tools-title">
              <Zap size={18} className="text-warning" />
              <div>
                <h4>Simulation & Outils Démo</h4>
                <p>Tester le système sans saturer l'écran</p>
              </div>
            </div>
            <button
              className="btn-close-tray"
              onClick={() => setShowDemoTools(false)}
              title="Fermer le panneau"
            >
              <X size={18} />
            </button>
          </div>

          <div className="demo-tools-body">
            <div className="demo-tool-card">
              <div className="demo-tool-info">
                <strong>Simuler un départ de feu (Mock)</strong>
                <p>Injecte un incident factice pour déclencher l'alerte temps-réel WebSocket.</p>
              </div>
              <button
                className="btn btn-danger btn-sm"
                onClick={handleTriggerDemo}
                disabled={isTriggering}
              >
                {isTriggering ? 'Simulation en cours...' : '🔥 Simuler Détection Feu'}
              </button>
            </div>

            <div className="demo-tool-card">
              <div className="demo-tool-info">
                <strong>Nettoyer & Réinitialiser la Démo</strong>
                <p>Supprime les feux de test et remet la base à l'état propre initial (Tikjda 40%).</p>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleResetDemo}
                disabled={isResetting}
              >
                {isResetting ? 'Nettoyage...' : '🔄 Remettre à Zéro (Clean)'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
