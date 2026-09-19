package hackathon.ibtikarhackathon.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "planting_zones")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PlantingZone {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long incidentId;

    @Column(nullable = false)
    private String name;

    @Lob
    @Column(columnDefinition = "TEXT", nullable = false)
    private String polygonGeoJson;

    @Column(nullable = false)
    private Integer targetTrees;

    @Column(nullable = false)
    @Builder.Default
    private Integer registeredVolunteers = 0;

    @Column(nullable = false)
    @Builder.Default
    private Integer treesPlanted = 0;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private ZoneStatus status = ZoneStatus.PLANNED;
}
