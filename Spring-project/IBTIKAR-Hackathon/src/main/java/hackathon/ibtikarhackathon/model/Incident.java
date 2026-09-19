package hackathon.ibtikarhackathon.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "incidents")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Incident {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String droneId;

    private Double lat;

    private Double lon;

    private Double confidence;

    private String label; // "fire" or "smoke"

    private String snapshotUrl;

    @Enumerated(EnumType.STRING)
    private Severity severity;

    @Enumerated(EnumType.STRING)
    private IncidentStatus status;

    private LocalDateTime createdAt;

    private String verifiedBy;

    private LocalDateTime verifiedAt;
}
