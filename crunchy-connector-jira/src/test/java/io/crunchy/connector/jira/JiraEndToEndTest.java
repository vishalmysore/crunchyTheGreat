package io.crunchy.connector.jira;

import io.crunchy.core.model.CompressedContext;
import io.crunchy.core.model.CompressionLevel;
import io.crunchy.core.model.NormalizedDocument;
import io.crunchy.core.pipeline.CompressionPipeline;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Full-path test: messy Jira JSON export → connector → pipeline → CIR.
 * Uses the shared sample under /samples so the CLI demo and the test
 * exercise the identical fixture.
 */
class JiraEndToEndTest {

    private static CompressedContext result;
    private static NormalizedDocument document;

    @BeforeAll
    static void compressFixture() throws IOException {
        Path fixture = Path.of("..", "samples", "messy-issue.json");
        assertTrue(Files.exists(fixture), "fixture missing: " + fixture.toAbsolutePath());
        document = new JiraIssueParser().parse(Files.readString(fixture));
        result = CompressionPipeline.standard().process(document, CompressionLevel.FULL);
    }

    @Test
    void connectorNormalizesTheIssue() {
        assertEquals("PAY-1421", document.getKey());
        assertEquals(12, document.getComments().size());
        assertTrue(document.getComments().get(3).bot(), "Jenkins CI must be flagged as a bot");
        assertEquals("In Progress", document.getMetadata().get("status"));
    }

    @Test
    void decisionsSurviveIncludingRejections() {
        assertTrue(result.getDecisions().stream().anyMatch(d -> d.contains("Kafka")),
                "Kafka decision missing: " + result.getDecisions());
        assertTrue(result.getDecisions().stream().anyMatch(d -> d.contains("RabbitMQ")),
                "RabbitMQ rejection missing: " + result.getDecisions());
        assertTrue(result.getDecisions().stream().anyMatch(d -> d.contains("Redis")),
                "Redis decision missing: " + result.getDecisions());
    }

    @Test
    void acceptanceCriteriaAreComplete() {
        assertTrue(result.getAcceptanceCriteria().size() >= 4,
                "expected 3 list items + Gherkin scenario, got: " + result.getAcceptanceCriteria());
        assertTrue(result.getAcceptanceCriteria().stream().anyMatch(a -> a.contains("HMAC")),
                "signing criterion missing: " + result.getAcceptanceCriteria());
    }

    @Test
    void risksTodosAndDependenciesAreCaptured() {
        assertTrue(result.getRisks().stream().anyMatch(r -> r.toLowerCase().contains("retry storm")),
                "retry-storm risk missing: " + result.getRisks());
        assertTrue(result.getTodos().stream().anyMatch(t -> t.contains("allowlist")),
                "egress-allowlist TODO missing: " + result.getTodos());
        assertTrue(result.getDependencies().stream().anyMatch(d -> d.contains("PLAT-77")),
                "PLAT-77 blocker missing: " + result.getDependencies());
    }

    @Test
    void relatedIssuesComeFromTextAndLinks() {
        assertTrue(result.getRelatedIssues().contains("PAY-1388"), result.getRelatedIssues().toString());
        assertTrue(result.getRelatedIssues().contains("PLAT-77"), result.getRelatedIssues().toString());
    }

    @Test
    void noiseIsRemovedAndReported() {
        assertTrue(result.getIgnoredContent().stream().anyMatch(i -> i.contains("bot")),
                "bot removal not reported: " + result.getIgnoredContent());
        assertTrue(result.getIgnoredContent().stream().anyMatch(i -> i.toLowerCase().contains("log")),
                "log-dump removal not reported: " + result.getIgnoredContent());
        assertTrue(result.getIgnoredContent().stream().anyMatch(i -> i.contains("duplicate")),
                "duplicate collapse not reported: " + result.getIgnoredContent());
    }

    @Test
    void compressionTargetIsMet() {
        assertTrue(result.getCompressionRatio() >= 0.5,
                "expected >=50% reduction even at FULL level, got " + result.getCompressionRatio());
        assertTrue(result.getConfidence() >= 0.9,
                "rich issue should score high confidence, got " + result.getConfidence());
    }
}
