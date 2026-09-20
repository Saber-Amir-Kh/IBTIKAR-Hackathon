import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Incident, DroneTelemetry, PlantingZone } from '../types';

interface LiveMapProps {
  incidents: Incident[];
  drones: DroneTelemetry[];
  selectedIncident: Incident | null;
  onSelectIncident: (incident: Incident) => void;
  zones: PlantingZone[];
  selectedZone: PlantingZone | null;
  onSelectZone: (zone: PlantingZone) => void;
}

export const LiveMap: React.FC<LiveMapProps> = ({
  incidents,
  drones,
  selectedIncident,
  onSelectIncident,
  zones,
  selectedZone,
  onSelectZone,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const droneLayerRef = useRef<L.LayerGroup | null>(null);
  const incidentLayerRef = useRef<L.LayerGroup | null>(null);
  const zoneLayerRef = useRef<L.LayerGroup | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Center on Northern Algeria (Tipaza, Algiers, Bouira, Tizi Ouzou corridor)
    const map = L.map(mapContainerRef.current, {
      center: [36.55, 3.25],
      zoom: 9,
      zoomControl: true,
    });

    // 1. Standard Streets Map (Light, clear roads and cities - 100% Free, NO WATERMARK, NO API KEY)
    const streetMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri &mdash; Sources: Esri, HERE, Garmin, USGS, Intermap, INCREMENT P, NRCan, Esri Japan, METI, Esri China (Hong Kong), Esri Korea, Esri (Thailand), NGCC, (c) OpenStreetMap contributors, and the GIS User Community',
      maxZoom: 19,
    });

    // 2. Topographic Relief Map (Natural terrain with contours and vegetation - 100% Free, NO WATERMARK)
    const topoMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri, USGS, NOAA',
      maxZoom: 19,
    });

    // 3. Satellite HD Map (High-resolution aerial imagery - 100% Free, NO WATERMARK)
    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri, Maxar, Earthstar Geographics',
      maxZoom: 19,
    });

    // Set standard light map as default (NO DARK THEME)
    streetMap.addTo(map);

    // Layer Switcher (Streets vs Topo vs Satellite)
    const baseLayers = {
      "Carte Standard": streetMap,
      "Topographique": topoMap,
      "Satellite HD": satellite,
    };
    L.control.layers(baseLayers, undefined, { position: 'topright' }).addTo(map);

    // Tactical Recenter Button (Top-Left under zoom)
    const recenterControl = new L.Control({ position: 'topleft' });
    recenterControl.onAdd = () => {
      const container = L.DomUtil.create('div', 'leaflet-bar tactical-recenter-btn');
      const btn = L.DomUtil.create('a', '', container);
      btn.href = '#';
      btn.title = 'Recentrer sur la zone opérationnelle';
      btn.setAttribute('role', 'button');
      btn.innerHTML = '🎯';
      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.on(btn, 'click', (e) => {
        L.DomEvent.preventDefault(e);
        map.flyTo([36.55, 3.25], 9, { duration: 1.0 });
      });
      return container;
    };
    recenterControl.addTo(map);

    droneLayerRef.current = L.layerGroup().addTo(map);
    incidentLayerRef.current = L.layerGroup().addTo(map);
    zoneLayerRef.current = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;

    // Invalidate size after layout settles to guarantee no 0-height glitch
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      clearTimeout(timer);
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Drones
  useEffect(() => {
    if (!droneLayerRef.current) return;
    droneLayerRef.current.clearLayers();

    drones.forEach((d) => {
      const droneIcon = L.divIcon({
        className: 'drone-custom-marker',
        html: `
          <div class="drone-marker-pin" style="transform: rotate(${d.heading}deg);">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
              <path d="M2 17l10 5 10-5"></path>
              <path d="M2 12l10 5 10-5"></path>
            </svg>
          </div>
          <div class="drone-marker-label">${d.droneId} (${Math.round(d.battery)}%)</div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([d.lat, d.lon], { icon: droneIcon });
      marker.bindTooltip(`
        <strong>${d.name} (${d.droneId})</strong><br/>
        GPS: ${d.lat.toFixed(4)}°N, ${d.lon.toFixed(4)}°E<br/>
        Cap: ${d.heading}° | Alt: ${d.altitude}m<br/>
        Batterie: ${d.battery}% [${d.status}]
      `);
      droneLayerRef.current?.addLayer(marker);
    });
  }, [drones]);

  // Update Incidents
  useEffect(() => {
    if (!incidentLayerRef.current) return;
    incidentLayerRef.current.clearLayers();

    incidents.forEach((inc) => {
      const isSelected = selectedIncident?.id === inc.id;

      let color = '#ef4444'; // Red
      let pulseClass = '';
      let statusLabel = 'Inconnu';

      switch (inc.status) {
        case 'PENDING_VERIFICATION':
          color = '#ef4444';
          pulseClass = 'marker-pulse-red';
          statusLabel = 'En attente vérification';
          break;
        case 'ACTIVE':
          color = '#dc2626';
          statusLabel = 'Feu Actif Confirmé';
          break;
        case 'CONTAINED':
          color = '#f59e0b';
          statusLabel = 'Incendie Maîtrisé';
          break;
        case 'REFORESTATION':
          color = '#10b981';
          statusLabel = 'Campagne Reboisement';
          break;
        case 'DISMISSED':
          color = '#64748b';
          statusLabel = 'Rejeté (Brûlage)';
          break;
      }

      const icon = L.divIcon({
        className: 'incident-custom-marker',
        html: `
          <div class="incident-pin ${pulseClass} ${isSelected ? 'marker-selected' : ''}" style="background-color: ${color};">
            <span class="incident-inner-icon">🔥</span>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const marker = L.marker([inc.lat, inc.lon], { icon });
      marker.on('click', () => {
        onSelectIncident(inc);
      });

      marker.bindTooltip(`
        <strong>Incident #${inc.id} [${statusLabel}]</strong><br/>
        Gravité: ${inc.severity} | Confiance: ${(inc.confidence * 100).toFixed(1)}%<br/>
        Drone: ${inc.droneId}<br/>
        <em>Cliquez pour ouvrir les détails</em>
      `);

      incidentLayerRef.current?.addLayer(marker);
    });
  }, [incidents, selectedIncident, onSelectIncident]);

  // Auto-fly to selected incident
  useEffect(() => {
    if (selectedIncident && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([selectedIncident.lat, selectedIncident.lon], 12, {
        duration: 1.0,
      });
    }
  }, [selectedIncident]);

  // Update Planting Zones Polygon Overlays
  useEffect(() => {
    if (!zoneLayerRef.current) return;
    zoneLayerRef.current.clearLayers();

    if (!selectedIncident || (selectedIncident.status !== 'CONTAINED' && selectedIncident.status !== 'REFORESTATION')) {
      return;
    }

    zones.forEach((zone) => {
      try {
        const geoJson = JSON.parse(zone.polygonGeoJson);
        const progress = zone.targetTrees > 0 ? (zone.treesPlanted / zone.targetTrees) : 0;

        // Dynamic brown to green color interpolation
        let fillColor = '#854d0e'; // Scorched brown
        if (progress >= 1.0) {
          fillColor = '#15803d'; // Forest green (done)
        } else if (progress >= 0.6) {
          fillColor = '#22c55e'; // Green
        } else if (progress >= 0.3) {
          fillColor = '#ca8a04'; // Olive / Amber
        }

        const isSelected = selectedZone?.id === zone.id;

        const polygonLayer = L.geoJSON(geoJson, {
          style: {
            color: isSelected ? '#38bdf8' : fillColor,
            weight: isSelected ? 3 : 2,
            opacity: 0.9,
            fillColor: fillColor,
            fillOpacity: isSelected ? 0.65 : 0.45,
          },
        });

        polygonLayer.on('click', () => {
          onSelectZone(zone);
        });

        polygonLayer.bindTooltip(`
          <strong>${zone.name}</strong><br/>
          Arbres plantés: ${zone.treesPlanted} / ${zone.targetTrees} (${Math.round(progress * 100)}%)<br/>
          Bénévoles inscrits: ${zone.registeredVolunteers}<br/>
          Statut: ${zone.status}
        `);

        zoneLayerRef.current?.addLayer(polygonLayer);
      } catch (err) {
        console.error('Failed to parse zone polygon GeoJSON:', err);
      }
    });
  }, [zones, selectedZone, selectedIncident, onSelectZone]);

  return (
    <div className="map-wrapper">
      <div ref={mapContainerRef} className="leaflet-map-container" />
      <div className="map-legend">
        <div className="legend-item"><span className="legend-color legend-red-pulse"></span> Alerte Non Confirmée</div>
        <div className="legend-item"><span className="legend-color legend-red"></span> Feu Actif</div>
        <div className="legend-item"><span className="legend-color legend-orange"></span> Incendie Maîtrisé</div>
        <div className="legend-item"><span className="legend-color legend-green"></span> Reboisement</div>
        <div className="legend-item"><span className="legend-color legend-blue"></span> Drone Patrouilleur</div>
      </div>
    </div>
  );
};
