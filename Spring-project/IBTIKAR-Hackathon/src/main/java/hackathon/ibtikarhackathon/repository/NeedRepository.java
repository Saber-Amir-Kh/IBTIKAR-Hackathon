package hackathon.ibtikarhackathon.repository;

import hackathon.ibtikarhackathon.model.Need;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface NeedRepository extends JpaRepository<Need, Long> {
    List<Need> findByIncidentIdOrderByIdAsc(Long incidentId);
}
