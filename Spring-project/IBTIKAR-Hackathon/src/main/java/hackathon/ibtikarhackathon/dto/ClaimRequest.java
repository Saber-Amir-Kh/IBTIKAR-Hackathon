package hackathon.ibtikarhackathon.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ClaimRequest {
    private Long userId;
    private String userName;
    private Integer quantity;
}
