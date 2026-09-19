package hackathon.ibtikarhackathon.controller;

import hackathon.ibtikarhackathon.dto.DroneTelemetry;
import hackathon.ibtikarhackathon.service.DroneTelemetryService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

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
}
