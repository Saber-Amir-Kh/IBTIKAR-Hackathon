package hackathon.ibtikarhackathon.controller;

import hackathon.ibtikarhackathon.dto.AlertResponse;
import hackathon.ibtikarhackathon.dto.NeedCreateRequest;
import hackathon.ibtikarhackathon.dto.StatusUpdateRequest;
import hackathon.ibtikarhackathon.model.Incident;
import hackathon.ibtikarhackathon.model.Need;
import hackathon.ibtikarhackathon.model.PlantingZone;
import hackathon.ibtikarhackathon.service.IncidentService;
import hackathon.ibtikarhackathon.service.NeedService;
import hackathon.ibtikarhackathon.service.PlantingZoneService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/incidents")
public class IncidentController {

    private final IncidentService incidentService;
    private final NeedService needService;
    private final PlantingZoneService plantingZoneService;

    public IncidentController(IncidentService incidentService, NeedService needService, PlantingZoneService plantingZoneService) {
        this.incidentService = incidentService;
        this.needService = needService;
        this.plantingZoneService = plantingZoneService;
    }

    @GetMapping
    public ResponseEntity<List<Incident>> getAllIncidents() {
        return ResponseEntity.ok(incidentService.getAllIncidents());
    }

    @GetMapping("/{id}")
    public ResponseEntity<Incident> getIncident(@PathVariable Long id) {
        return ResponseEntity.ok(incidentService.getIncidentById(id));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<Incident> updateStatus(@PathVariable Long id, @RequestBody StatusUpdateRequest request) {
        Incident updated = incidentService.updateStatus(id, request);
        return ResponseEntity.ok(updated);
    }

    @GetMapping("/{id}/alert")
    public ResponseEntity<AlertResponse> getAlert(@PathVariable Long id) {
        return ResponseEntity.ok(incidentService.generateAlert(id));
    }

    @GetMapping("/{id}/needs")
    public ResponseEntity<List<Need>> getNeeds(@PathVariable Long id) {
        return ResponseEntity.ok(needService.getNeedsByIncident(id));
    }

    @PostMapping("/{id}/needs")
    public ResponseEntity<Need> createNeed(@PathVariable Long id, @RequestBody NeedCreateRequest request) {
        Need created = needService.createNeed(id, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping("/{id}/zones")
    public ResponseEntity<List<PlantingZone>> getZones(@PathVariable Long id) {
        return ResponseEntity.ok(plantingZoneService.getZonesByIncident(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteIncident(@PathVariable Long id) {
        incidentService.deleteIncident(id);
        return ResponseEntity.noContent().build();
    }
}
