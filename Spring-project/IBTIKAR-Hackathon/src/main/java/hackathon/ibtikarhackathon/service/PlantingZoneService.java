package hackathon.ibtikarhackathon.service;

import hackathon.ibtikarhackathon.model.PlantingZone;
import hackathon.ibtikarhackathon.model.ZoneStatus;
import hackathon.ibtikarhackathon.repository.PlantingZoneRepository;
import hackathon.ibtikarhackathon.websocket.PlainWebSocketHandler;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Slf4j
@Service
public class PlantingZoneService {

    private final PlantingZoneRepository zoneRepository;
    private final PlainWebSocketHandler webSocketHandler;

    public PlantingZoneService(PlantingZoneRepository zoneRepository, PlainWebSocketHandler webSocketHandler) {
        this.zoneRepository = zoneRepository;
        this.webSocketHandler = webSocketHandler;
    }

    public List<PlantingZone> getZonesByIncident(Long incidentId) {
        return zoneRepository.findByIncidentIdOrderByIdAsc(incidentId);
    }

    @Transactional
    public void deleteByIncidentId(Long incidentId) {
        List<PlantingZone> zones = zoneRepository.findByIncidentIdOrderByIdAsc(incidentId);
        zoneRepository.deleteAll(zones);
    }

    @Transactional
    public List<PlantingZone> generateZonesForIncident(Long incidentId, Double centerLat, Double centerLon) {
        // If zones already exist, return them
        List<PlantingZone> existing = zoneRepository.findByIncidentIdOrderByIdAsc(incidentId);
        if (!existing.isEmpty()) {
            return existing;
        }

        if (centerLat == null || centerLon == null) {
            centerLat = 36.455;
            centerLon = 4.135;
        }

        List<PlantingZone> createdZones = new ArrayList<>();

        String[] sectorNames = {
                "Secteur A - Versant Nord (Pins d'Alep)",
                "Secteur B - Crête Est (Chênes-lièges)",
                "Secteur C - Ravin Sud (Cèdres de l'Atlas)",
                "Secteur D - Pente Ouest (Oliviers sauvages)",
                "Secteur E - Bassin Central (Caroubiers & Genévriers)"
        };

        int[] targets = { 450, 600, 520, 380, 450 };

        double[][] sectorAngleRanges = {
                { 15.0, 85.0 },
                { 85.0, 155.0 },
                { 155.0, 225.0 },
                { 225.0, 295.0 },
                { 295.0, 375.0 }
        };

        Random rand = new Random(incidentId * 31);

        for (int i = 0; i < sectorNames.length; i++) {
            double startAngle = Math.toRadians(sectorAngleRanges[i][0]);
            double endAngle = Math.toRadians(sectorAngleRanges[i][1]);

            // Create 6-point irregular polygon wedge
            List<double[]> points = new ArrayList<>();
            // Inner point near center with small random offset
            double innerR = 0.002 + rand.nextDouble() * 0.001;
            points.add(new double[]{
                    centerLon + innerR * Math.cos((startAngle + endAngle) / 2.0),
                    centerLat + innerR * Math.sin((startAngle + endAngle) / 2.0)
            });

            int steps = 4;
            for (int s = 0; s <= steps; s++) {
                double angle = startAngle + (endAngle - startAngle) * (s / (double) steps);
                // 1.2 to 2.0 km radius in degrees (~0.011 to 0.018 deg)
                double outerR = 0.012 + (rand.nextDouble() * 0.006);
                points.add(new double[]{
                        centerLon + outerR * Math.cos(angle),
                        centerLat + outerR * Math.sin(angle)
                });
            }

            // Close the polygon
            points.add(points.get(0));

            StringBuilder geoJson = new StringBuilder();
            geoJson.append("{\"type\":\"Polygon\",\"coordinates\":[[");
            for (int p = 0; p < points.size(); p++) {
                double[] pt = points.get(p);
                geoJson.append(String.format(Locale.US, "[%.6f,%.6f]", pt[0], pt[1]));
                if (p < points.size() - 1) {
                    geoJson.append(",");
                }
            }
            geoJson.append("]]}");

            PlantingZone zone = PlantingZone.builder()
                    .incidentId(incidentId)
                    .name(sectorNames[i])
                    .polygonGeoJson(geoJson.toString())
                    .targetTrees(targets[i])
                    .registeredVolunteers(0)
                    .treesPlanted(0)
                    .status(ZoneStatus.PLANNED)
                    .build();

            createdZones.add(zoneRepository.save(zone));
        }

        log.info("Auto-generated {} planting zones for contained incident ID {}", createdZones.size(), incidentId);
        return createdZones;
    }

    @Transactional
    public PlantingZone registerVolunteer(Long zoneId) {
        PlantingZone zone = zoneRepository.findById(zoneId)
                .orElseThrow(() -> new IllegalArgumentException("Planting zone not found: " + zoneId));

        zone.setRegisteredVolunteers(zone.getRegisteredVolunteers() + 1);
        PlantingZone saved = zoneRepository.save(zone);

        webSocketHandler.broadcast("zone_updated", saved);
        return saved;
    }

    @Transactional
    public PlantingZone plantTrees(Long zoneId, int trees) {
        if (trees <= 0) {
            throw new IllegalArgumentException("Tree count must be greater than zero");
        }

        PlantingZone zone = zoneRepository.findById(zoneId)
                .orElseThrow(() -> new IllegalArgumentException("Planting zone not found: " + zoneId));

        int newTotal = zone.getTreesPlanted() + trees;
        zone.setTreesPlanted(newTotal);

        if (newTotal >= zone.getTargetTrees()) {
            zone.setStatus(ZoneStatus.DONE);
        } else if (newTotal > 0) {
            zone.setStatus(ZoneStatus.IN_PROGRESS);
        }

        PlantingZone saved = zoneRepository.save(zone);
        webSocketHandler.broadcast("zone_updated", saved);
        return saved;
    }
}
