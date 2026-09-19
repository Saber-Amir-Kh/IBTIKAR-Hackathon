package hackathon.ibtikarhackathon.controller;

import hackathon.ibtikarhackathon.dto.PlantTreesRequest;
import hackathon.ibtikarhackathon.model.PlantingZone;
import hackathon.ibtikarhackathon.service.PlantingZoneService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/zones")
public class PlantingZoneController {

    private final PlantingZoneService plantingZoneService;

    public PlantingZoneController(PlantingZoneService plantingZoneService) {
        this.plantingZoneService = plantingZoneService;
    }

    @PostMapping("/{id}/register")
    public ResponseEntity<PlantingZone> registerVolunteer(@PathVariable Long id) {
        PlantingZone zone = plantingZoneService.registerVolunteer(id);
        return ResponseEntity.ok(zone);
    }

    @PostMapping("/{id}/plant")
    public ResponseEntity<PlantingZone> plantTrees(@PathVariable Long id, @RequestBody PlantTreesRequest request) {
        int count = (request.getTrees() != null) ? request.getTrees() : 10;
        PlantingZone zone = plantingZoneService.plantTrees(id, count);
        return ResponseEntity.ok(zone);
    }
}
