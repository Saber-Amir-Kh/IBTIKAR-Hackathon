package hackathon.ibtikarhackathon.dto;

import hackathon.ibtikarhackathon.model.IncidentStatus;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class StatusUpdateRequest {
    private IncidentStatus status;
    private String verifiedBy;
}
