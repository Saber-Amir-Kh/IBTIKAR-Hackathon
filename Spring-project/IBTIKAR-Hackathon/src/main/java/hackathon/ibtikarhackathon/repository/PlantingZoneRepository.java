package hackathon.ibtikarhackathon.repository;

import hackathon.ibtikarhackathon.model.PlantingZone;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface PlantingZoneRepository extends JpaRepository<PlantingZone, Long> {
    List<PlantingZone> findByIncidentIdOrderByIdAsc(Long incidentId);
}
