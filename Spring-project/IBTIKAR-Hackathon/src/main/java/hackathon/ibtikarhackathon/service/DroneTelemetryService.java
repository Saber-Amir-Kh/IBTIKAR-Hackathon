package hackathon.ibtikarhackathon.service;

import hackathon.ibtikarhackathon.dto.DroneTelemetry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Service
public class DroneTelemetryService {

    private static class DroneInternalState {
        String id;
        String name;
        String sector;
        String model;
        String status;
        double centerLat;
        double centerLon;
        double radius;
        double speed; // radians per tick
        double currentAngle;
        double altitude;
        double battery;
        double heading;
        double currentLat;
        double currentLon;

        DroneInternalState(String id, String name, String sector, String model, double centerLat, double centerLon, double radius, double speed, double altitude, double initialBattery) {
            this.id = id;
            this.name = name;
            this.sector = sector;
            this.model = model;
            this.status = "PATROL_ACTIVE";
            this.centerLat = centerLat;
            this.centerLon = centerLon;
            this.radius = radius;
            this.speed = speed;
            this.currentAngle = Math.random() * Math.PI * 2;
            this.altitude = altitude;
            this.battery = initialBattery;
            this.currentLat = centerLat;
            this.currentLon = centerLon;
            this.heading = 0.0;
        }

        void tick() {
            if ("HOVER_SCAN".equalsIgnoreCase(status)) {
                altitude += (Math.random() - 0.5) * 0.4;
                if (battery > 5.0) battery -= 0.006;
                return;
            }

            if ("RETURN_TO_HOME".equalsIgnoreCase(status) || "RTH".equalsIgnoreCase(status)) {
                double dLat = centerLat - currentLat;
                double dLon = centerLon - currentLon;
                double dist = Math.hypot(dLat, dLon);
                if (dist < 0.001) {
                    status = "CHARGING";
                } else {
                    currentLat += (dLat / dist) * 0.0005;
                    currentLon += (dLon / dist) * 0.0005;
                    double angleDeg = Math.toDegrees(Math.atan2(dLon, dLat));
                    if (angleDeg < 0) angleDeg += 360;
                    heading = Math.round(angleDeg * 10.0) / 10.0;
                }
                if (battery > 5.0) battery -= 0.008;
                return;
            }

            if ("CHARGING".equalsIgnoreCase(status)) {
                if (battery < 100.0) {
                    battery = Math.min(100.0, battery + 0.8);
                } else {
                    status = "STANDBY";
                }
                return;
            }

            if ("STANDBY".equalsIgnoreCase(status)) {
                return;
            }

            // Default: PATROL_ACTIVE
            currentAngle = (currentAngle + speed) % (Math.PI * 2);
            double prevLat = currentLat;
            double prevLon = currentLon;

            // Parametric ellipse
            currentLat = centerLat + radius * Math.cos(currentAngle);
            currentLon = centerLon + (radius * 1.3) * Math.sin(currentAngle);

            // Heading calculation in degrees
            double dLat = currentLat - prevLat;
            double dLon = currentLon - prevLon;
            double angleDeg = Math.toDegrees(Math.atan2(dLon, dLat));
            if (angleDeg < 0) {
                angleDeg += 360;
            }
            heading = Math.round(angleDeg * 10.0) / 10.0;

            // Small altitude fluctuation
            altitude += (Math.random() - 0.5) * 1.5;

            // Slow battery discharge
            if (battery > 5.0) {
                battery -= 0.01;
            }
        }

        DroneTelemetry toDto() {
            return DroneTelemetry.builder()
                    .droneId(id)
                    .name(name)
                    .lat(Math.round(currentLat * 100000.0) / 100000.0)
                    .lon(Math.round(currentLon * 100000.0) / 100000.0)
                    .altitude(Math.round(altitude * 10.0) / 10.0)
                    .battery(Math.round(battery * 10.0) / 10.0)
                    .heading(heading)
                    .status(status != null ? status : "PATROL_ACTIVE")
                    .sector(sector)
                    .model(model)
                    .build();
        }
    }

    private final Map<String, DroneInternalState> drones = new ConcurrentHashMap<>();

    public DroneTelemetryService() {
        // Tikjda (36.455, 4.135)
        drones.put("DRONE-DZ-01", new DroneInternalState(
                "DRONE-DZ-01", "Patrouilleur Tikjda-1", "Parc National de Tikjda (Bouira)", "DJI Matrice 300 RTK",
                36.455, 4.135, 0.015, 0.05, 420.0, 94.5
        ));

        // Djebel Chenoua (36.605, 2.295)
        drones.put("DRONE-DZ-02", new DroneInternalState(
                "DRONE-DZ-02", "Gardien Chenoua-2", "Forêt Côtière Djebel Chenoua (Tipaza)", "Autel EVO Max 4T",
                36.605, 2.295, 0.018, 0.04, 380.0, 88.0
        ));

        // Beni Yenni (36.63, 4.15)
        drones.put("DRONE-DZ-03", new DroneInternalState(
                "DRONE-DZ-03", "Sentinelle Béni Yenni-3", "Massif Forestier Béni Yenni (Tizi Ouzou)", "DJI FlyCart 30 Dual",
                36.63, 4.15, 0.012, 0.06, 450.0, 91.2
        ));
    }

    @Scheduled(fixedRate = 1000)
    public void updateTelemetry() {
        for (DroneInternalState drone : drones.values()) {
            drone.tick();
        }
    }

    public List<DroneTelemetry> getAllTelemetry() {
        List<DroneTelemetry> list = new ArrayList<>();
        for (DroneInternalState drone : drones.values()) {
            list.add(drone.toDto());
        }
        return list;
    }

    public boolean sendCommand(String droneId, String command, Map<String, Object> params) {
        DroneInternalState drone = drones.get(droneId);
        if (drone == null) return false;

        switch (command.toUpperCase()) {
            case "RETURN_TO_HOME":
            case "RTH":
                drone.status = "RETURN_TO_HOME";
                break;
            case "RESUME_PATROL":
            case "PATROL":
                drone.status = "PATROL_ACTIVE";
                break;
            case "HOVER":
            case "SCAN":
                drone.status = "HOVER_SCAN";
                break;
            case "RECHARGE":
                drone.battery = 100.0;
                drone.status = "PATROL_ACTIVE";
                break;
            case "SET_SECTOR":
                if (params != null) {
                    if (params.containsKey("lat") && params.containsKey("lon")) {
                        drone.centerLat = Double.parseDouble(params.get("lat").toString());
                        drone.centerLon = Double.parseDouble(params.get("lon").toString());
                        drone.currentLat = drone.centerLat;
                        drone.currentLon = drone.centerLon;
                    }
                    if (params.containsKey("sector")) {
                        drone.sector = params.get("sector").toString();
                    }
                }
                break;
            default:
                break;
        }
        return true;
    }

    public void recallAll() {
        for (DroneInternalState drone : drones.values()) {
            drone.status = "RETURN_TO_HOME";
        }
    }

    public void resumeAll() {
        for (DroneInternalState drone : drones.values()) {
            drone.status = "PATROL_ACTIVE";
        }
    }

    public DroneTelemetry deployDrone(String name, String sector, Double lat, Double lon, Double altitude) {
        int nextNum = drones.size() + 1;
        String id = String.format("DRONE-DZ-%02d", nextNum);
        double cLat = lat != null ? lat : 36.50;
        double cLon = lon != null ? lon : 3.50;
        double alt = altitude != null ? altitude : 400.0;
        String sec = sector != null && !sector.isBlank() ? sector : "Secteur Opérationnel #" + nextNum;
        String nm = name != null && !name.isBlank() ? name : "Sentinelle Flotte-" + nextNum;

        DroneInternalState newDrone = new DroneInternalState(
                id, nm, sec, "DJI Matrice 350 RTK",
                cLat, cLon, 0.015, 0.05, alt, 100.0
        );
        drones.put(id, newDrone);
        return newDrone.toDto();
    }

    public DroneTelemetry getNearestDrone(Double targetLat, Double targetLon) {
        if (drones.isEmpty()) {
            return DroneTelemetry.builder()
                    .droneId("DRONE-DZ-01")
                    .name("Patrouilleur Tikjda-1")
                    .lat(36.455)
                    .lon(4.135)
                    .status("PATROL_ACTIVE")
                    .sector("Parc National de Tikjda (Bouira)")
                    .model("DJI Matrice 300 RTK")
                    .build();
        }

        if (targetLat == null || targetLon == null) {
            // Pick the primary active drone
            return drones.getOrDefault("DRONE-DZ-01", drones.values().iterator().next()).toDto();
        }

        DroneInternalState closest = null;
        double minDistance = Double.MAX_VALUE;

        for (DroneInternalState drone : drones.values()) {
            double dLat = drone.currentLat - targetLat;
            double dLon = drone.currentLon - targetLon;
            double dist = dLat * dLat + dLon * dLon;
            if (dist < minDistance) {
                minDistance = dist;
                closest = drone;
            }
        }

        return closest != null ? closest.toDto() : drones.values().iterator().next().toDto();
    }
}
