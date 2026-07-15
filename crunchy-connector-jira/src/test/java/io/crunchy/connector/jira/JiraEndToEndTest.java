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
 * Uses the shared healthcare sample under /samples so the CLI demo and the
 * test exercise the identical fixture.
 */
class JiraEndToEndTest {

    private static CompressedContext result;
    private static NormalizedDocument document;

    @BeforeAll
    static void compressFixture() throws IOException {
        Path fixture = Path.of("..", "samples", "healthcare-issue.json");
        assertTrue(Files.exists(fixture), "fixture missing: " + fixture.toAbsolutePath());
        document = new JiraIssueParser().parse(Files.readString(fixture));
        result = CompressionPipeline.standard().process(document, CompressionLevel.FULL);
    }

    @Test
    void connectorNormalizesTheIssue() {
        assertEquals("CARE-2087", document.getKey());
        assertEquals(12, document.getComments().size());
        assertTrue(document.getComments().get(3).bot(), "Jenkins CI must be flagged as a bot");
        assertEquals("In Progress", document.getMetadata().get("status"));
    }

    @Test
    void decisionsSurviveIncludingRejections() {
        assertTrue(result.getDecisions().stream().anyMatch(d -> d.contains("FHIR R4")),
                "FHIR decision missing: " + result.getDecisions());
        assertTrue(result.getDecisions().stream().anyMatch(d -> d.contains("custom JSON bridge")),
                "custom-bridge rejection missing: " + result.getDecisions());
        assertTrue(result.getDecisions().stream().anyMatch(d -> d.contains("Redis")),
                "Redis decision missing: " + result.getDecisions());
    }

    @Test
    void acceptanceCriteriaAreComplete() {
        assertTrue(result.getAcceptanceCriteria().size() >= 4,
                "expected 3 list items + Gherkin scenario, got: " + result.getAcceptanceCriteria());
        assertTrue(result.getAcceptanceCriteria().stream().anyMatch(a -> a.contains("HIPAA")),
                "audit criterion missing: " + result.getAcceptanceCriteria());
    }

    @Test
    void risksTodosAndDependenciesAreCaptured() {
        assertTrue(result.getRisks().stream().anyMatch(r -> r.contains("HIPAA")),
                "PHI/HIPAA risk missing: " + result.getRisks());
        assertTrue(result.getTodos().stream().anyMatch(t -> t.contains("backoff")),
                "retry-backoff TODO missing: " + result.getTodos());
        assertTrue(result.getDependencies().stream().anyMatch(d -> d.contains("EHR-14")),
                "EHR-14 blocker missing: " + result.getDependencies());
    }

    @Test
    void relatedIssuesComeFromTextAndLinks() {
        assertTrue(result.getRelatedIssues().contains("CARE-2050"), result.getRelatedIssues().toString());
        assertTrue(result.getRelatedIssues().contains("EHR-14"), result.getRelatedIssues().toString());
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
        assertTrue(result.getCompressionRatio() >= 0.3,
                "expected >=30% reduction at FULL level, got " + result.getCompressionRatio());
        assertTrue(result.getConfidence() >= 0.9,
                "rich issue should score high confidence, got " + result.getConfidence());
    }
}
