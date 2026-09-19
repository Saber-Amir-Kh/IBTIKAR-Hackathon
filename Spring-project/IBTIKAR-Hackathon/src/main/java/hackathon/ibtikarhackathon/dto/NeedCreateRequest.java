package hackathon.ibtikarhackathon.dto;

import hackathon.ibtikarhackathon.model.NeedCategory;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class NeedCreateRequest {
    private String title;
    private Integer quantity;
    private NeedCategory category;
    private String postedBy;
}
