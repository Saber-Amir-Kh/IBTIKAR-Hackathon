package hackathon.ibtikarhackathon;

import com.fasterxml.jackson.databind.ObjectMapper;
import hackathon.ibtikarhackathon.dto.ClaimRequest;
import hackathon.ibtikarhackathon.dto.DetectionRequest;
import hackathon.ibtikarhackathon.dto.NeedCreateRequest;
import hackathon.ibtikarhackathon.dto.StatusUpdateRequest;
import hackathon.ibtikarhackathon.model.IncidentStatus;
import hackathon.ibtikarhackathon.model.NeedCategory;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class WildfireIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void testInitialSeedUsersAndTelemetry() throws Exception {
        mockMvc.perform(get("/api/users"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(4)))
                .andExpect(jsonPath("$[0].name", is("Karim Haddad")))
                .andExpect(jsonPath("$[0].role", is("COORDINATOR")));

        mockMvc.perform(get("/api/telemetry"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].droneId", notNullValue()));
    }

    @Test
    void testDetectionAndLifecycleAndAlert() throws Exception {
        // 1. Post detection
        DetectionRequest detection = new DetectionRequest(
                "fire",
                0.95,
                "http://localhost:8000/snapshots/test.jpg",
                "2026-09-19T05:00:00Z"
        );

        String incidentJson = mockMvc.perform(post("/api/detections")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(detection)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.status", is("PENDING_VERIFICATION")))
                .andExpect(jsonPath("$.severity", is("HIGH")))
                .andReturn().getResponse().getContentAsString();

        Long incidentId = objectMapper.readTree(incidentJson).get("id").asLong();

        // 2. Alert endpoint
        mockMvc.perform(get("/api/incidents/" + incidentId + "/alert"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.titleFr", containsString("ALERTE INCENDIE")))
                .andExpect(jsonPath("$.titleAr", containsString("تحذير حريق")))
                .andExpect(jsonPath("$.committeeFr", containsString("Tajmaât")))
                .andExpect(jsonPath("$.safeObjectivesFr", hasSize(5)));

        // 3. Confirm incident (PENDING_VERIFICATION -> ACTIVE)
        StatusUpdateRequest confirmReq = new StatusUpdateRequest(IncidentStatus.ACTIVE, "Amine Ait-Ahmed");
        mockMvc.perform(patch("/api/incidents/" + incidentId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(confirmReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("ACTIVE")));

        // 4. Post a need
        NeedCreateRequest needReq = new NeedCreateRequest("Réserves d'eau 20L", 50, NeedCategory.WATER, "Karim Haddad");
        String needJson = mockMvc.perform(post("/api/incidents/" + incidentId + "/needs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(needReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.quantity", is(50)))
                .andExpect(jsonPath("$.quantityClaimed", is(0)))
                .andReturn().getResponse().getContentAsString();

        Long needId = objectMapper.readTree(needJson).get("id").asLong();

        // 5. Volunteer claims 20 items
        ClaimRequest claimReq = new ClaimRequest(3L, "Yasmine Mansouri", 20);
        mockMvc.perform(post("/api/needs/" + needId + "/claims")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(claimReq)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.quantity", is(20)));

        // 6. Test over-claim prevention: attempt to claim 40 when only 30 left -> should fail
        ClaimRequest overClaimReq = new ClaimRequest(3L, "Yasmine Mansouri", 40);
        mockMvc.perform(post("/api/needs/" + needId + "/claims")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(overClaimReq)))
                .andExpect(status().is4xxClientError());

        // 7. Transition ACTIVE -> CONTAINED -> triggers zone generation
        StatusUpdateRequest containReq = new StatusUpdateRequest(IncidentStatus.CONTAINED, "Karim Haddad");
        mockMvc.perform(patch("/api/incidents/" + incidentId + "/status")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(containReq)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("CONTAINED")));

        // Verify auto-generated zones
        mockMvc.perform(get("/api/incidents/" + incidentId + "/zones"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(5)))
                .andExpect(jsonPath("$[0].polygonGeoJson", containsString("Polygon")));
    }

    @Test
    void testDemoTriggerAndReset() throws Exception {
        mockMvc.perform(post("/api/demo/trigger-detection"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.status", is("PENDING_VERIFICATION")));

        mockMvc.perform(post("/api/demo/reset"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("success")));
    }
}
