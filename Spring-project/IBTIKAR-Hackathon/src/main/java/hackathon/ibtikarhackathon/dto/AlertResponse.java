package hackathon.ibtikarhackathon.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AlertResponse {
    private Long incidentId;
    private String titleFr;
    private String titleAr;
    private String location;
    private String severityFr;
    private String severityAr;
    private String timestamp;
    private String committeeFr;
    private String committeeAr;
    private List<String> safeObjectivesFr;
    private List<String> safeObjectivesAr;
    private String rawBroadcastFr;
    private String rawBroadcastAr;
}
