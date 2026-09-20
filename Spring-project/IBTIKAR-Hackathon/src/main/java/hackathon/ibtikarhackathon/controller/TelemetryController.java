package hackathon.ibtikarhackathon.controller;

import hackathon.ibtikarhackathon.dto.DroneTelemetry;
import hackathon.ibtikarhackathon.service.DroneTelemetryService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/telemetry")
public class TelemetryController {

    private final DroneTelemetryService droneTelemetryService;

    public TelemetryController(DroneTelemetryService droneTelemetryService) {
        this.droneTelemetryService = droneTelemetryService;
    }

    @GetMapping
    public ResponseEntity<List<DroneTelemetry>> getTelemetry() {
        return ResponseEntity.ok(droneTelemetryService.getAllTelemetry());
    }

    @PostMapping("/{droneId}/command")
    public ResponseEntity<?> sendCommand(@PathVariable String droneId, @RequestBody Map<String, Object> body) {
        String command = (String) body.get("command");
        @SuppressWarnings("unchecked")
        Map<String, Object> params = (Map<String, Object>) body.get("params");
        boolean ok = droneTelemetryService.sendCommand(droneId, command, params);
        if (ok) {
            return ResponseEntity.ok(Map.of("success", true, "droneId", droneId, "command", command));
        } else {
            return ResponseEntity.notFound().build();
        }
    }

    @PostMapping("/recall-all")
    public ResponseEntity<?> recallAll() {
        droneTelemetryService.recallAll();
        return ResponseEntity.ok(Map.of("success", true, "message", "RTH initié pour tous les drones"));
    }

    @PostMapping("/resume-all")
    public ResponseEntity<?> resumeAll() {
        droneTelemetryService.resumeAll();
        return ResponseEntity.ok(Map.of("success", true, "message", "Patrouille reprise pour tous les drones"));
    }

    @PostMapping("/deploy")
    public ResponseEntity<DroneTelemetry> deployDrone(@RequestBody Map<String, Object> body) {
        String name = (String) body.get("name");
        String sector = (String) body.get("sector");
        Double lat = body.get("lat") != null ? Double.valueOf(body.get("lat").toString()) : null;
        Double lon = body.get("lon") != null ? Double.valueOf(body.get("lon").toString()) : null;
        Double altitude = body.get("altitude") != null ? Double.valueOf(body.get("altitude").toString()) : null;
        DroneTelemetry created = droneTelemetryService.deployDrone(name, sector, lat, lon, altitude);
        return ResponseEntity.ok(created);
    }
}
