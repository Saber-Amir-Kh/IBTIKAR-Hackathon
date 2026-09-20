import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { LiveMap } from './components/LiveMap';
import { SidePanel } from './components/SidePanel';
import { IncidentDetailsModal } from './components/IncidentDetailsModal';
import { MutualAidBoard } from './components/MutualAidBoard';
import { ReforestationPanel } from './components/ReforestationPanel';
import { FireManagementPanel } from './components/FireManagementPanel';
import { DroneManagementPanel } from './components/DroneManagementPanel';
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
  updateIncidentStatus,
  deleteIncident,
  triggerDemoDetection,
  resetDemo,
  sendDroneCommand,
  recallAllDrones,
  resumeAllDrones,
  deployDrone,
} from './api';
import { LandingPage } from './components/LandingPage';
import './App.css';

const DEFAULT_USERS: User[] = [
  { id: 1, name: 'Karim Haddad', role: 'COORDINATOR' },
  { id: 2, name: 'Amine Ait-Ahmed', role: 'COMMITTEE_HEAD' },
  { id: 3, name: 'Yasmine Mansouri', role: 'VOLUNTEER' },
  { id: 4, name: 'Tarek Benali', role: 'ECO_CLUB' },
];

const getInitialView = (): 'landing' | 'dashboard' => {
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  if (path === '/dashboard' || path === '/app' || hash === '#dashboard') {
    return 'dashboard';
  }
  const saved = localStorage.getItem('sentinelle_route');
  if (saved === 'dashboard') {
    return 'dashboard';
  }
  return 'landing';
};

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
  const [activeViewTab, setActiveViewTab] = useState<'map' | 'incident' | 'aid' | 'reforest' | 'fires' | 'drones'>('map');
  const [mapFilter, setMapFilter] = useState<'ALL' | 'ACTIVE_ONLY'>(() => {
    return (localStorage.getItem('sentinelle_map_filter') as 'ALL' | 'ACTIVE_ONLY') || 'ALL';
  });
  const [assignedTeams, setAssignedTeams] = useState<Record<number, string>>(() => {
    try {
      const saved = localStorage.getItem('sentinelle_fire_teams');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [isTriggering, setIsTriggering] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [showDemoTools, setShowDemoTools] = useState(false);
  const [currentView, setCurrentView] = useState<'landing' | 'dashboard'>(getInitialView);

  const navigateTo = (view: 'landing' | 'dashboard') => {
    setCurrentView(view);
    localStorage.setItem('sentinelle_route', view);
    if (view === 'dashboard') {
      if (window.location.pathname !== '/dashboard') {
        window.history.pushState({ view: 'dashboard' }, '', '/dashboard');
      }
    } else {
      if (window.location.pathname !== '/') {
        window.history.pushState({ view: 'landing' }, '', '/');
      }
    }
  };

  useEffect(() => {
    const onPopState = () => {
      const isDashboard = window.location.pathname === '/dashboard' || window.location.hash === '#dashboard';
      const target = isDashboard ? 'dashboard' : 'landing';
      setCurrentView(target);
      localStorage.setItem('sentinelle_route', target);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const wsRef = useRef<WebSocket | null>(null);

  const addEvent = useCallback((type: string, text: string, incidentId?: number) => {
    const item: EventLogItem = {
      id: Math.random().toString(36).substring(2, 9),
      time: new Date().toLocaleTimeString('fr-DZ'),
      type,
      text,
      incidentId,
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
        addEvent('DETECTION', `Alerte départ de feu détecté par ${newInc.droneId} (Confiance: ${(newInc.confidence * 100).toFixed(0)}%) !`, newInc.id);
        break;
      }
      case 'incident_updated': {
        const updated: Incident = msg.payload;
        setIncidents((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
        if (selectedIncident?.id === updated.id) {
          setSelectedIncident(updated);
          loadIncidentSubData(updated.id);
        }
        addEvent('INCIDENT', `Incident #${updated.id} mis à jour : Statut -> ${updated.status}`, updated.id);
        break;
      }
      case 'need_posted': {
        const need: Need = msg.payload;
        if (selectedIncident?.id === need.incidentId) {
          setNeeds((prev) => [...prev.filter((n) => n.id !== need.id), need]);
        }
        addEvent('BESOIN', `Nouveau besoin publié : ${need.title} (${need.quantity})`, need.incidentId);
        break;
      }
      case 'need_claimed': {
        const need: Need = msg.payload;
        if (selectedIncident?.id === need.incidentId) {
          setNeeds((prev) => prev.map((n) => (n.id === need.id ? need : n)));
        }
        addEvent('RÉCLAMATION', `Besoin satisfait : ${need.title} (${need.quantityClaimed}/${need.quantity})`, need.incidentId);
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
        addEvent('REBOISEMENT', `Parcelle mise à jour : ${zone.name} (${zone.treesPlanted}/${zone.targetTrees} arbres)`, zone.incidentId);
        break;
      }
      case 'incident_deleted': {
        const payload = msg.payload;
        const deletedId = typeof payload === 'object' && payload !== null ? payload.id : Number(payload);
        if (deletedId) {
          setIncidents((prev) => prev.filter((i) => i.id !== deletedId));
          if (selectedIncident?.id === deletedId) {
            setSelectedIncident(null);
          }
          addEvent('INCIDENT', `Feu #${deletedId} supprimé du système (Désaturation).`);
        }
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

  // Fire Management & Anti-Saturation Handlers
  const handleDeleteIncident = async (id: number) => {
    try {
      await deleteIncident(id);
      setIncidents((prev) => prev.filter((i) => i.id !== id));
      if (selectedIncident?.id === id) {
        setSelectedIncident((prev) => (prev?.id === id ? null : prev));
      }
      addEvent('SUPPRESSION', `Feu #${id} supprimé de la carte (Désaturation).`);
    } catch (err: any) {
      alert('Erreur lors de la suppression du feu : ' + err.message);
    }
  };

  const handleKeepIncident = async (inc: Incident) => {
    try {
      const updated = await updateIncidentStatus(inc.id, 'ACTIVE', currentUser.name);
      setIncidents((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      if (selectedIncident?.id === updated.id) {
        setSelectedIncident(updated);
      }
      addEvent('CONFIRMATION', `Feu #${inc.id} confirmé et conservé comme feu actif prioritaire.`, inc.id);
    } catch (err: any) {
      alert('Erreur lors de la confirmation du feu : ' + err.message);
    }
  };

  const handleAssignTeam = (incidentId: number, teamName: string) => {
    setAssignedTeams((prev) => {
      const next = { ...prev, [incidentId]: teamName };
      localStorage.setItem('sentinelle_fire_teams', JSON.stringify(next));
      return next;
    });
    addEvent(
      'ÉQUIPE',
      teamName ? `Équipe "${teamName}" assignée au feu #${incidentId}.` : `Équipe retirée du feu #${incidentId}.`,
      incidentId
    );
  };

  const handleToggleMapFilter = (filter: 'ALL' | 'ACTIVE_ONLY') => {
    setMapFilter(filter);
    localStorage.setItem('sentinelle_map_filter', filter);
    addEvent(
      'FILTRE',
      filter === 'ACTIVE_ONLY'
        ? 'Désaturation activée : seuls les feux actifs sont affichés sur la carte.'
        : 'Affichage complet : tous les feux sont visibles sur la carte.'
    );
  };

  const handleClearDismissed = async () => {
    const dismissed = incidents.filter((i) => i.status === 'DISMISSED');
    if (dismissed.length === 0) return;
    if (!window.confirm(`Supprimer définitivement ${dismissed.length} feux rejetés pour désaturer la carte ?`)) return;

    for (const d of dismissed) {
      await deleteIncident(d.id);
    }
    setIncidents((prev) => prev.filter((i) => i.status !== 'DISMISSED'));
    addEvent('NETTOYAGE', `${dismissed.length} alertes rejetées supprimées définitivement.`);
  };

  // Drone Fleet Management Handlers
  const handleSendDroneCommand = async (droneId: string, command: string, params?: Record<string, any>) => {
    try {
      await sendDroneCommand(droneId, command, params);
      setDrones((prev) =>
        prev.map((d) => {
          if (d.droneId !== droneId) return d;
          let nextStatus = d.status;
          let nextBattery = d.battery;
          if (command === 'HOVER' || command === 'SCAN') nextStatus = 'HOVER_SCAN';
          else if (command === 'RESUME_PATROL' || command === 'PATROL') nextStatus = 'PATROL_ACTIVE';
          else if (command === 'RETURN_TO_HOME' || command === 'RTH') nextStatus = 'RETURN_TO_HOME';
          else if (command === 'RECHARGE') {
            nextStatus = 'PATROL_ACTIVE';
            nextBattery = 100.0;
          }
          return { ...d, status: nextStatus, battery: nextBattery };
        })
      );
      addEvent('DRONE', `Ordre "${command}" exécuté pour ${droneId}.`);
    } catch (err: any) {
      alert('Erreur commande drone : ' + err.message);
    }
  };

  const handleRecallAllDrones = async () => {
    try {
      await recallAllDrones();
      setDrones((prev) => prev.map((d) => ({ ...d, status: 'RETURN_TO_HOME' })));
      addEvent('DRONE', 'Ordre RTH Global : toute la flotte regagne sa base de décollage.');
    } catch (err: any) {
      alert('Erreur rappel flotte : ' + err.message);
    }
  };

  const handleResumeAllDrones = async () => {
    try {
      await resumeAllDrones();
      setDrones((prev) => prev.map((d) => ({ ...d, status: 'PATROL_ACTIVE' })));
      addEvent('DRONE', 'Reprise des patrouilles de surveillance sur l\'ensemble des massifs.');
    } catch (err: any) {
      alert('Erreur reprise patrouille : ' + err.message);
    }
  };

  const handleDeployDrone = async (data: { name: string; sector: string; lat: number; lon: number; altitude?: number }) => {
    try {
      const created = await deployDrone(data);
      setDrones((prev) => [...prev, created]);
      addEvent('DRONE', `Nouveau drone déployé : ${created.name} (${created.droneId}) sur ${data.sector}.`);
    } catch (err: any) {
      alert('Erreur déploiement drone : ' + err.message);
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

  if (currentView === 'landing') {
    return <LandingPage onEnterPlatform={() => navigateTo('dashboard')} />;
  }

  const mapIncidents = mapFilter === 'ACTIVE_ONLY'
    ? incidents.filter((i) => i.status === 'ACTIVE' || i.status === 'PENDING_VERIFICATION')
    : incidents;

  return (
    <div className="tactical-shell">
      {/* 1. Tactical Left Sidebar */}
      <Sidebar
        activeTab={activeViewTab === 'map' ? 'map' : activeViewTab === 'aid' ? 'aid' : activeViewTab === 'fires' ? 'fires' : activeViewTab === 'drones' ? 'drones' : 'reforest'}
        onSelectTab={(tab) => setActiveViewTab(tab)}
        needsCount={needs.length}
        zonesCount={zones.length}
        firesCount={incidents.length}
        dronesCount={drones.length}
        showDemoTools={showDemoTools}
        onToggleDemoTools={() => setShowDemoTools((prev) => !prev)}
        onBackToLanding={() => navigateTo('landing')}
      />

      {/* 2. Main Workspace */}
      <div className="tactical-workspace">
        {/* Top Operations Bar */}
        <TopBar
          incidents={incidents}
          selectedIncident={selectedIncident}
          onSelectIncident={(inc) => {
            setSelectedIncident(inc);
            loadIncidentSubData(inc.id);
            setInspectModalOpen(true);
          }}
          onInspectIncident={() => setInspectModalOpen(true)}
          currentUser={currentUser}
          users={users}
          onSelectUser={setCurrentUser}
          wsConnected={wsConnected}
          droneCount={drones.length || 3}
        />

        {/* Content View */}
        <main className="tactical-content">
          {activeViewTab === 'map' && (
            <div className="map-view-layout">
              <div className="map-column">
                <LiveMap
                  incidents={mapIncidents}
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
                <SidePanel
                  events={events}
                  onClearEvents={() => setEvents([])}
                  onSelectEvent={(evt) => {
                    if (evt.incidentId) {
                      const match = incidents.find((i) => i.id === evt.incidentId);
                      if (match) {
                        setSelectedIncident(match);
                        loadIncidentSubData(match.id);
                      }
                    } else if (selectedIncident) {
                      loadIncidentSubData(selectedIncident.id);
                    } else if (incidents.length > 0) {
                      setSelectedIncident(incidents[0]);
                      loadIncidentSubData(incidents[0].id);
                    }
                    setInspectModalOpen(true);
                  }}
                  incidents={incidents}
                  selectedIncident={selectedIncident}
                  onSelectIncident={(inc) => {
                    setSelectedIncident(inc);
                    loadIncidentSubData(inc.id);
                  }}
                  onInspectIncident={(inc) => {
                    setSelectedIncident(inc);
                    loadIncidentSubData(inc.id);
                    setInspectModalOpen(true);
                  }}
                  onDeleteIncident={handleDeleteIncident}
                  onKeepIncident={handleKeepIncident}
                  onAssignTeam={handleAssignTeam}
                  assignedTeams={assignedTeams}
                />
              </div>
            </div>
          )}

          {activeViewTab === 'fires' && (
            <div className="subview-layout">
              <FireManagementPanel
                incidents={incidents}
                selectedIncident={selectedIncident}
                onSelectIncident={(inc) => {
                  setSelectedIncident(inc);
                  loadIncidentSubData(inc.id);
                }}
                onInspectIncident={(inc) => {
                  setSelectedIncident(inc);
                  loadIncidentSubData(inc.id);
                  setInspectModalOpen(true);
                }}
                onDeleteIncident={handleDeleteIncident}
                onKeepIncident={handleKeepIncident}
                onAssignTeam={handleAssignTeam}
                assignedTeams={assignedTeams}
                mapFilter={mapFilter}
                onToggleMapFilter={handleToggleMapFilter}
                onClearDismissed={handleClearDismissed}
                onNavigateToMap={() => setActiveViewTab('map')}
              />
            </div>
          )}

          {activeViewTab === 'drones' && (
            <div className="subview-layout">
              <DroneManagementPanel
                drones={drones}
                onSendCommand={handleSendDroneCommand}
                onRecallAll={handleRecallAllDrones}
                onResumeAll={handleResumeAllDrones}
                onDeployDrone={handleDeployDrone}
                onNavigateToMapWithDrone={(_d) => {
                  setActiveViewTab('map');
                }}
                onNavigateToFeed={() => {
                  setActiveViewTab('map');
                }}
              />
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
                <div className="empty-selection-placeholder">
                  Veuillez sélectionner un incident dans la barre supérieure.
                </div>
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
                <div className="empty-selection-placeholder">
                  Veuillez sélectionner un incident dans la barre supérieure.
                </div>
              )}
            </div>
          )}
        </main>
      </div>

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
              <span className="sim-bullet font-bold">●</span>
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
              ✕
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
