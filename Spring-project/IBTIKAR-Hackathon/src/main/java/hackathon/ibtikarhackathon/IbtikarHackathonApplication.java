package hackathon.ibtikarhackathon;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class IbtikarHackathonApplication {

    public static void main(String[] args) {
        SpringApplication.run(IbtikarHackathonApplication.class, args);
    }

}
