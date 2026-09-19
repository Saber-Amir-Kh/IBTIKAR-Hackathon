package hackathon.ibtikarhackathon.service;

import hackathon.ibtikarhackathon.dto.AlertResponse;
import hackathon.ibtikarhackathon.dto.DetectionRequest;
import hackathon.ibtikarhackathon.dto.DroneTelemetry;
import hackathon.ibtikarhackathon.dto.StatusUpdateRequest;
import hackathon.ibtikarhackathon.model.Incident;
import hackathon.ibtikarhackathon.model.IncidentStatus;
import hackathon.ibtikarhackathon.model.Severity;
import hackathon.ibtikarhackathon.repository.IncidentRepository;
import hackathon.ibtikarhackathon.websocket.PlainWebSocketHandler;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

@Slf4j
@Service
public class IncidentService {

    private final IncidentRepository incidentRepository;
    private final DroneTelemetryService droneTelemetryService;
    private final PlantingZoneService plantingZoneService;
    private final PlainWebSocketHandler webSocketHandler;

    public IncidentService(IncidentRepository incidentRepository,
                           DroneTelemetryService droneTelemetryService,
                           PlantingZoneService plantingZoneService,
                           PlainWebSocketHandler webSocketHandler) {
        this.incidentRepository = incidentRepository;
        this.droneTelemetryService = droneTelemetryService;
        this.plantingZoneService = plantingZoneService;
        this.webSocketHandler = webSocketHandler;
    }

    public List<Incident> getAllIncidents() {
        return incidentRepository.findAllByOrderByCreatedAtDesc();
    }

    public Incident getIncidentById(Long id) {
        return incidentRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Incident non trouvé avec l'identifiant: " + id));
    }

    @Transactional
    public Incident processDetection(DetectionRequest request) {
        double confidence = (request.getConfidence() != null) ? request.getConfidence() : 0.85;
        String label = (request.getLabel() != null) ? request.getLabel().toLowerCase() : "fire";

        // Derive severity
        Severity severity;
        if (confidence < 0.80) {
            severity = Severity.LOW;
        } else if (confidence <= 0.90) {
            severity = Severity.MEDIUM;
        } else {
            severity = Severity.HIGH;
        }

        // Bind nearest simulated drone position
        DroneTelemetry drone = droneTelemetryService.getNearestDrone(null, null);

        Incident incident = Incident.builder()
                .droneId(drone.getDroneId())
                .lat(drone.getLat())
                .lon(drone.getLon())
                .confidence(confidence)
                .label(label)
                .snapshotUrl(request.getSnapshotUrl() != null ? request.getSnapshotUrl() : "http://localhost:8080/snapshots/demo-fire.jpg")
                .severity(severity)
                .status(IncidentStatus.PENDING_VERIFICATION)
                .createdAt(LocalDateTime.now())
                .build();

        Incident saved = incidentRepository.save(incident);
        log.info("New incident created from detection: ID={}, Drone={}, Severity={}", saved.getId(), saved.getDroneId(), saved.getSeverity());

        webSocketHandler.broadcast("detection", saved);
        return saved;
    }

    @Transactional
    public Incident updateStatus(Long id, StatusUpdateRequest request) {
        Incident incident = getIncidentById(id);
        IncidentStatus current = incident.getStatus();
        IncidentStatus target = request.getStatus();

        if (target == null) {
            throw new IllegalArgumentException("Statut cible obligatoire");
        }

        // Validate state machine transitions
        boolean isValid = false;
        if (current == IncidentStatus.PENDING_VERIFICATION) {
            isValid = (target == IncidentStatus.ACTIVE || target == IncidentStatus.DISMISSED);
        } else if (current == IncidentStatus.ACTIVE) {
            isValid = (target == IncidentStatus.CONTAINED);
        } else if (current == IncidentStatus.CONTAINED) {
            isValid = (target == IncidentStatus.REFORESTATION);
        }

        if (!isValid) {
            throw new IllegalArgumentException(String.format(
                    "Transition d'état interdite: de %s vers %s. Transitions autorisées: " +
                    "PENDING_VERIFICATION -> ACTIVE|DISMISSED, ACTIVE -> CONTAINED, CONTAINED -> REFORESTATION",
                    current, target
            ));
        }

        incident.setStatus(target);
        if (request.getVerifiedBy() != null && !request.getVerifiedBy().isBlank()) {
            incident.setVerifiedBy(request.getVerifiedBy());
            incident.setVerifiedAt(LocalDateTime.now());
        }

        // If contained or reforestation, auto-generate planting zones if not present
        if (target == IncidentStatus.CONTAINED || target == IncidentStatus.REFORESTATION) {
            plantingZoneService.generateZonesForIncident(incident.getId(), incident.getLat(), incident.getLon());
        }

        Incident saved = incidentRepository.save(incident);
        log.info("Incident ID={} transitionné vers {}", saved.getId(), saved.getStatus());

        webSocketHandler.broadcast("incident_updated", saved);
        return saved;
    }

    public AlertResponse generateAlert(Long id) {
        Incident incident = getIncidentById(id);

        String locationStr = String.format(Locale.US, "GPS: %.4f°N, %.4f°E (Secteur sous surveillance %s)",
                incident.getLat(), incident.getLon(), incident.getDroneId());

        String severityFr = switch (incident.getSeverity()) {
            case HIGH -> "URGENCE ABSOLUE - Risque Majeur";
            case MEDIUM -> "VIGILANCE ÉLEVÉE - Propagation Modérée";
            case LOW -> "ALERTE INITIALE - Départ Suspect";
        };

        String severityAr = switch (incident.getSeverity()) {
            case HIGH -> "حالة طوارئ قصوى - خطر داهم";
            case MEDIUM -> "يقظة عالية - انتشار متوسط";
            case LOW -> "إنذار أولي - بداية حريق مشتبهة";
        };

        List<String> safeObjectivesFr = Arrays.asList(
                "1. Défricher d'urgence la broussaille et herbes sèches dans un rayon de 50m autour des habitations.",
                "2. Créer des tranchées pare-feu le long des pistes principales pour stopper la litière au sol.",
                "3. Dégager et sécuriser immédiatement les voies d'accès carrossables pour les camions de la Protection Civile.",
                "4. Évacuer en priorité absolue les personnes âgées, enfants, asthmatiques et bétail vers la place centrale du village.",
                "AVIS DE SÉCURITÉ VITAL : Ne jamais tenter d'affronter directement le front des flammes sans tenue ignifuge et formation professionnelle."
        );

        List<String> safeObjectivesAr = Arrays.asList(
                "1. تنظيف الأحراش والأعشاب اليابسة بشكل عاجل في محيط 50 متراً حول المنازل السكنية.",
                "2. حفر خطوط وخنادق صد النيران (Pare-feu) على أطراف المسالك الغابية لوقف زحف الحريق.",
                "3. إخلاء وتأمين الطرق والمسالك الرئيسية لتمكين شاحنات الحماية المدنية من الوصول السريع.",
                "4. إجلاء ذوي الأولوية فوراً: كبار السن، الأطفال، المصابين بالحساسية التنفسية، والمواشي نحو ساحة القرية الآمنة.",
                "تنبيه أمني بالغ الأهمية: يمنع منعاً باتاً الهجوم المباشر على ألسنة اللهب بدون معدات وتكوين مهني مختص."
        );

        String timestampStr = incident.getCreatedAt() != null
                ? incident.getCreatedAt().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"))
                : LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"));

        String rawFr = String.format(
                "🚨 ALERTE INCENDIE - COMITÉ DE VILLAGE TAJMAÂT 🚨\n" +
                "Date/Heure: %s\n" +
                "Localisation: %s\n" +
                "Niveau de gravité: %s\n" +
                "Directives de sécurité communautaire:\n" +
                "- Défricher les abords des maisons et créer des pare-feux\n" +
                "- Dégager les routes pour la Protection Civile\n" +
                "- Évacuer les personnes âgées et enfants\n" +
                "⚠️ Ne pas attaquer directement les flammes.",
                timestampStr, locationStr, severityFr
        );

        String rawAr = String.format(
                "🚨 تحذير عاجل من حريق - لجان قرى ثاجماعث 🚨\n" +
                "التوقيت: %s\n" +
                "الموقع: %s\n" +
                "مستوى الخطورة: %s\n" +
                "التعليمات الوقائية الميدانية:\n" +
                "- تنظيف محيط المنازل وإنشاء خطوط عازلة\n" +
                "- فتح المسالك لشاحنات الحماية المدنية\n" +
                "- إجلاء الأطفال والشيوخ أولاً\n" +
                "⚠️ تجنب الاقتراب المباشر من النيران.",
                timestampStr, locationStr, severityAr
        );

        return AlertResponse.builder()
                .incidentId(incident.getId())
                .titleFr("ALERTE INCENDIE COMMUNAUTAIRE - TAJMAÂT")
                .titleAr("تحذير حريق مجتمعي - ثاجماعث")
                .location(locationStr)
                .severityFr(severityFr)
                .severityAr(severityAr)
                .timestamp(timestampStr)
                .committeeFr("Comité Populaire de Surveillance et de Sauvegarde (Tajmaât)")
                .committeeAr("لجنة المراقبة الشعبية والنجدة (ثاجماعث)")
                .safeObjectivesFr(safeObjectivesFr)
                .safeObjectivesAr(safeObjectivesAr)
                .rawBroadcastFr(rawFr)
                .rawBroadcastAr(rawAr)
                .build();
    }
}
