package hackathon.ibtikarhackathon.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "needs")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Need {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long incidentId;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false)
    private Integer quantity;

    @Column(nullable = false)
    @Builder.Default
    private Integer quantityClaimed = 0;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private NeedCategory category;

    @Column(nullable = false)
    private String postedBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private NeedStatus status = NeedStatus.OPEN;
}
