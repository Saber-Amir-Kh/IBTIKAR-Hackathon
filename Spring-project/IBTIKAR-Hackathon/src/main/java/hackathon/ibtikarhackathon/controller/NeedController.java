package hackathon.ibtikarhackathon.controller;

import hackathon.ibtikarhackathon.dto.ClaimRequest;
import hackathon.ibtikarhackathon.model.Claim;
import hackathon.ibtikarhackathon.service.NeedService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/needs")
public class NeedController {

    private final NeedService needService;

    public NeedController(NeedService needService) {
        this.needService = needService;
    }

    @PostMapping("/{id}/claims")
    public ResponseEntity<Claim> claimNeed(@PathVariable Long id, @RequestBody ClaimRequest request) {
        Claim claim = needService.claimNeed(id, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(claim);
    }

    @GetMapping("/{id}/claims")
    public ResponseEntity<List<Claim>> getClaims(@PathVariable Long id) {
        return ResponseEntity.ok(needService.getClaimsByNeed(id));
    }
}
