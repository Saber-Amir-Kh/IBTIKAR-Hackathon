package hackathon.ibtikarhackathon.controller;

import hackathon.ibtikarhackathon.dto.DetectionRequest;
import hackathon.ibtikarhackathon.model.Incident;
import hackathon.ibtikarhackathon.service.IncidentService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/detections")
public class DetectionController {

    private final IncidentService incidentService;

    public DetectionController(IncidentService incidentService) {
        this.incidentService = incidentService;
    }

    @PostMapping
    public ResponseEntity<Incident> handleDetection(@RequestBody DetectionRequest request) {
        Incident incident = incidentService.processDetection(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(incident);
    }
}
