package hackathon.ibtikarhackathon.service;

import hackathon.ibtikarhackathon.dto.ClaimRequest;
import hackathon.ibtikarhackathon.dto.NeedCreateRequest;
import hackathon.ibtikarhackathon.model.Claim;
import hackathon.ibtikarhackathon.model.Need;
import hackathon.ibtikarhackathon.model.NeedStatus;
import hackathon.ibtikarhackathon.repository.ClaimRepository;
import hackathon.ibtikarhackathon.repository.NeedRepository;
import hackathon.ibtikarhackathon.websocket.PlainWebSocketHandler;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Slf4j
@Service
public class NeedService {

    private final NeedRepository needRepository;
    private final ClaimRepository claimRepository;
    private final PlainWebSocketHandler webSocketHandler;

    public NeedService(NeedRepository needRepository, ClaimRepository claimRepository, PlainWebSocketHandler webSocketHandler) {
        this.needRepository = needRepository;
        this.claimRepository = claimRepository;
        this.webSocketHandler = webSocketHandler;
    }

    public List<Need> getNeedsByIncident(Long incidentId) {
        return needRepository.findByIncidentIdOrderByIdAsc(incidentId);
    }

    public List<Claim> getClaimsByNeed(Long needId) {
        return claimRepository.findByNeedIdOrderByCreatedAtDesc(needId);
    }

    @Transactional
    public Need createNeed(Long incidentId, NeedCreateRequest request) {
        if (request.getTitle() == null || request.getTitle().isBlank()) {
            throw new IllegalArgumentException("Le titre du besoin est obligatoire");
        }
        if (request.getQuantity() == null || request.getQuantity() <= 0) {
            throw new IllegalArgumentException("La quantité doit être supérieure à zéro");
        }

        Need need = Need.builder()
                .incidentId(incidentId)
                .title(request.getTitle())
                .quantity(request.getQuantity())
                .quantityClaimed(0)
                .category(request.getCategory())
                .postedBy(request.getPostedBy() != null ? request.getPostedBy() : "Coordinateur")
                .status(NeedStatus.OPEN)
                .build();

        Need saved = needRepository.save(need);
        log.info("Nouveau besoin créé: ID={}, Titre={}, Quantité={}", saved.getId(), saved.getTitle(), saved.getQuantity());

        webSocketHandler.broadcast("need_posted", saved);
        return saved;
    }

    @Transactional
    public Claim claimNeed(Long needId, ClaimRequest request) {
        if (request.getQuantity() == null || request.getQuantity() <= 0) {
            throw new IllegalArgumentException("La quantité réclamée doit être supérieure à zéro");
        }

        Need need = needRepository.findById(needId)
                .orElseThrow(() -> new IllegalArgumentException("Besoin non trouvé avec l'identifiant: " + needId));

        int available = need.getQuantity() - need.getQuantityClaimed();
        if (request.getQuantity() > available) {
            throw new IllegalArgumentException(String.format(
                    "Dépassement de quota interdit ! Quantité restante disponible : %d, demandée : %d",
                    available, request.getQuantity()
            ));
        }

        // Update need quantity claimed
        int newTotalClaimed = need.getQuantityClaimed() + request.getQuantity();
        need.setQuantityClaimed(newTotalClaimed);
        if (newTotalClaimed >= need.getQuantity()) {
            need.setStatus(NeedStatus.FULFILLED);
        }
        needRepository.save(need);

        // Record claim
        Claim claim = Claim.builder()
                .needId(needId)
                .userId(request.getUserId() != null ? request.getUserId() : 1L)
                .userName(request.getUserName() != null ? request.getUserName() : "Bénévole Tajmaât")
                .quantity(request.getQuantity())
                .createdAt(LocalDateTime.now())
                .build();

        Claim savedClaim = claimRepository.save(claim);
        log.info("Besoin ID={} réclamé: +{} par {}", needId, request.getQuantity(), claim.getUserName());

        webSocketHandler.broadcast("need_claimed", need);
        return savedClaim;
    }
}
