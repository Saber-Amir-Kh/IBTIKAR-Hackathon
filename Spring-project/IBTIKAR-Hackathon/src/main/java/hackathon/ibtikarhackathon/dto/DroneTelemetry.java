package hackathon.ibtikarhackathon.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DroneTelemetry {
    private String droneId;
    private String name;
    private Double lat;
    private Double lon;
    private Double altitude;
    private Double battery;
    private Double heading;
    private String status;
}
