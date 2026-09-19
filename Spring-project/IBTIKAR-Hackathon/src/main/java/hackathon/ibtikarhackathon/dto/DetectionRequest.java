package hackathon.ibtikarhackathon.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DetectionRequest {
    private String label; // "fire" or "smoke"
    private Double confidence;
    private String snapshotUrl;
    private String detectedAt;
}
