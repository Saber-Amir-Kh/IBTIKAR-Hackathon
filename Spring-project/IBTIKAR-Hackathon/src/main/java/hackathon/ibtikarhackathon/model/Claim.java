package hackathon.ibtikarhackathon.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "claims")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class


Claim {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long needId;

    @Column(nullable = false)
    private Long userId;

    private String userName;

    @Column(nullable = false)
    private Integer quantity;

    private LocalDateTime createdAt;
}
