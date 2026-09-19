package hackathon.ibtikarhackathon.service;

import hackathon.ibtikarhackathon.model.*;
import hackathon.ibtikarhackathon.repository.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

@Slf4j
@Component
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final IncidentRepository incidentRepository;
    private final NeedRepository needRepository;
    private final ClaimRepository claimRepository;
    private final PlantingZoneRepository plantingZoneRepository;
    private final PlantingZoneService plantingZoneService;

    public DataInitializer(UserRepository userRepository,
                           IncidentRepository incidentRepository,
                           NeedRepository needRepository,
                           ClaimRepository claimRepository,
                           PlantingZoneRepository plantingZoneRepository,
                           PlantingZoneService plantingZoneService) {
        this.userRepository = userRepository;
        this.incidentRepository = incidentRepository;
        this.needRepository = needRepository;
        this.claimRepository = claimRepository;
        this.plantingZoneRepository = plantingZoneRepository;
        this.plantingZoneService = plantingZoneService;
    }

    @Override
    public void run(String... args) {
        if (userRepository.count() == 0) {
            seed();
        }
    }

    @Transactional
    public void reset() {
        log.info("Resetting wildfire database to clean seed state...");
        claimRepository.deleteAll();
        needRepository.deleteAll();
        plantingZoneRepository.deleteAll();
        incidentRepository.deleteAll();
        userRepository.deleteAll();
        seed();
        log.info("Reset and reseed completed successfully.");
    }

    @Transactional
    public void seed() {
        log.info("Seeding initial wildfire data...");

        // 1. Seed 4 demo users
        User karim = User.builder().name("Karim Haddad").role(UserRole.COORDINATOR).build();
        User amine = User.builder().name("Amine Ait-Ahmed").role(UserRole.COMMITTEE_HEAD).build();
        User yasmine = User.builder().name("Yasmine Mansouri").role(UserRole.VOLUNTEER).build();
        User tarek = User.builder().name("Tarek Benali").role(UserRole.ECO_CLUB).build();
        userRepository.saveAll(Arrays.asList(karim, amine, yasmine, tarek));

        // 2. Seed 1 historical CONTAINED incident at Djebel Chenoua
        LocalDateTime past = LocalDateTime.now().minusDays(3);
        Incident historical = Incident.builder()
                .droneId("DRONE-DZ-02")
                .lat(36.605)
                .lon(2.295)
                .confidence(0.94)
                .label("fire")
                .snapshotUrl("http://localhost:8080/snapshots/demo-fire.jpg")
                .severity(Severity.HIGH)
                .status(IncidentStatus.CONTAINED)
                .createdAt(past)
                .verifiedBy("Amine Ait-Ahmed (Président Tajmaât)")
                .verifiedAt(past.plusHours(1))
                .build();
        Incident savedIncident = incidentRepository.save(historical);

        // 3. Seed historical needs for this incident
        Need n1 = Need.builder()
                .incidentId(savedIncident.getId())
                .title("Pack d'eau minérale (packs de 6)")
                .quantity(150)
                .quantityClaimed(150)
                .category(NeedCategory.WATER)
                .postedBy("Karim Haddad")
                .status(NeedStatus.FULFILLED)
                .build();

        Need n2 = Need.builder()
                .incidentId(savedIncident.getId())
                .title("Pelles et râteaux de coupe-feu")
                .quantity(40)
                .quantityClaimed(40)
                .category(NeedCategory.TOOLS)
                .postedBy("Karim Haddad")
                .status(NeedStatus.FULFILLED)
                .build();

        Need n3 = Need.builder()
                .incidentId(savedIncident.getId())
                .title("Masques filtrants FFP2 / FFP3")
                .quantity(100)
                .quantityClaimed(100)
                .category(NeedCategory.SAFETY)
                .postedBy("Karim Haddad")
                .status(NeedStatus.FULFILLED)
                .build();

        needRepository.saveAll(Arrays.asList(n1, n2, n3));

        // 4. Generate planting zones around Djebel Chenoua and set to 40% complete
        List<PlantingZone> zones = plantingZoneService.generateZonesForIncident(savedIncident.getId(), savedIncident.getLat(), savedIncident.getLon());
        int totalTarget = zones.stream().mapToInt(PlantingZone::getTargetTrees).sum(); // e.g. 2400
        int targetToPlant = (int) Math.round(totalTarget * 0.40); // 40%

        int remainingToDistribute = targetToPlant;
        for (int i = 0; i < zones.size(); i++) {
            PlantingZone z = zones.get(i);
            int portion = Math.min(z.getTargetTrees(), Math.max(0, remainingToDistribute / (zones.size() - i)));
            remainingToDistribute -= portion;

            z.setTreesPlanted(portion);
            z.setRegisteredVolunteers(12 + i * 4);
            if (portion >= z.getTargetTrees()) {
                z.setStatus(ZoneStatus.DONE);
            } else if (portion > 0) {
                z.setStatus(ZoneStatus.IN_PROGRESS);
            } else {
                z.setStatus(ZoneStatus.PLANNED);
            }
            plantingZoneRepository.save(z);
        }

        log.info("Seed complete: 4 users, 1 historical contained incident, 3 fulfilled needs, 5 planting zones (40% replanted).");
    }
}
