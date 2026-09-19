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

        DroneInternalState(String id, String name, double centerLat, double centerLon, double radius, double speed, double altitude, double initialBattery) {
            this.id = id;
            this.name = name;
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
            if (battery > 20.0) {
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
                    .status("PATROL_ACTIVE")
                    .build();
        }
    }

    private final Map<String, DroneInternalState> drones = new ConcurrentHashMap<>();

    public DroneTelemetryService() {
        // Tikjda (36.455, 4.135)
        drones.put("DRONE-DZ-01", new DroneInternalState(
                "DRONE-DZ-01", "Patrouilleur Tikjda-1", 36.455, 4.135, 0.015, 0.05, 420.0, 94.5
        ));

        // Djebel Chenoua (36.605, 2.295)
        drones.put("DRONE-DZ-02", new DroneInternalState(
                "DRONE-DZ-02", "Gardien Chenoua-2", 36.605, 2.295, 0.018, 0.04, 380.0, 88.0
        ));

        // Beni Yenni (36.63, 4.15)
        drones.put("DRONE-DZ-03", new DroneInternalState(
                "DRONE-DZ-03", "Sentinelle Béni Yenni-3", 36.63, 4.15, 0.012, 0.06, 450.0, 91.2
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

    public DroneTelemetry getNearestDrone(Double targetLat, Double targetLon) {
        if (drones.isEmpty()) {
            return DroneTelemetry.builder()
                    .droneId("DRONE-DZ-01")
                    .name("Patrouilleur Tikjda-1")
                    .lat(36.455)
                    .lon(4.135)
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
