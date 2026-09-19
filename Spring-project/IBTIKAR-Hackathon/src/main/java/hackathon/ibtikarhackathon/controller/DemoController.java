package hackathon.ibtikarhackathon.controller;

import hackathon.ibtikarhackathon.dto.DetectionRequest;
import hackathon.ibtikarhackathon.model.Incident;
import hackathon.ibtikarhackathon.service.DataInitializer;
import hackathon.ibtikarhackathon.service.IncidentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
@RequestMapping("/api/demo")
public class DemoController {

    private final IncidentService incidentService;
    private final DataInitializer dataInitializer;

    public DemoController(IncidentService incidentService, DataInitializer dataInitializer) {
        this.incidentService = incidentService;
        this.dataInitializer = dataInitializer;
    }

    @PostMapping("/trigger-detection")
    public ResponseEntity<Incident> triggerFakeDetection() {
        DetectionRequest request = new DetectionRequest(
                "fire",
                0.93,
                "http://localhost:8080/snapshots/demo-fire.jpg",
                Instant.now().toString()
        );
        Incident incident = incidentService.processDetection(request);
        return ResponseEntity.ok(incident);
    }

    @PostMapping("/reset")
    public ResponseEntity<Map<String, Object>> resetDemo() {
        dataInitializer.reset();
        return ResponseEntity.ok(Map.of(
                "status", "success",
                "message", "Base réinitialisée avec succès aux données d'origine (4 utilisateurs, 1 incident contenu, reboisement à 40%)"
        ));
    }
}
