package io.crunchy.core;

import io.crunchy.core.model.CompressedContext;
import io.crunchy.core.model.CompressionLevel;
import io.crunchy.core.model.NormalizedDocument;
import io.crunchy.core.pipeline.CompressionPipeline;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PipelineExtractionTest {

    private CompressedContext run(NormalizedDocument doc) {
        return CompressionPipeline.standard().process(doc, CompressionLevel.FULL);
    }

    @Test
    void extractsDecisionsIncludingRejections() {
        NormalizedDocument doc = new NormalizedDocument();
        doc.setKey("ABC-1");
        doc.setTitle("Pick a cache");
        doc.setDescription("We decided to use Redis for the session cache. Memcached was rejected because it lacks persistence.");

        CompressedContext result = run(doc);
        assertTrue(result.getDecisions().stream().anyMatch(d -> d.contains("Redis")),
                "expected a Redis decision, got: " + result.getDecisions());
        assertTrue(result.getDecisions().stream().anyMatch(d -> d.contains("Memcached")),
                "expected the Memcached rejection, got: " + result.getDecisions());
    }

    @Test
    void extractsAcceptanceCriteriaFromSectionAndGherkin() {
        NormalizedDocument doc = new NormalizedDocument();
        doc.setKey("ABC-2");
        doc.setTitle("Login");
        doc.setDescription("""
                Acceptance Criteria
                - User can log in with email and password
                - Account locks after 5 failed attempts

                Given a locked account
                When the user resets the password
                Then the account unlocks
                """);

        CompressedContext result = run(doc);
        assertTrue(result.getAcceptanceCriteria().size() >= 3,
                "expected section items plus a Gherkin scenario, got: " + result.getAcceptanceCriteria());
        assertTrue(result.getAcceptanceCriteria().stream().anyMatch(a -> a.startsWith("Given")),
                "Gherkin scenario missing: " + result.getAcceptanceCriteria());
    }

    @Test
    void proseStartingWithWhenIsNotAGherkinScenario() {
        NormalizedDocument doc = new NormalizedDocument();
        doc.setKey("ABC-5");
        doc.setTitle("Booking");
        doc.setDescription("When a patient books a visit, the appointment must appear in the EHR "
                + "so that staff stop re-typing it.");

        CompressedContext result = run(doc);
        assertTrue(result.getAcceptanceCriteria().isEmpty(),
                "single 'When ...' prose sentence must not become an AC: "
                        + result.getAcceptanceCriteria());
    }

    @Test
    void collapsesRepeatedComments() {
        NormalizedDocument doc = new NormalizedDocument();
        doc.setKey("ABC-3");
        doc.setTitle("Broker choice");
        doc.setDescription("Pick the message broker for order events.");
        doc.getComments().add(new NormalizedDocument.Comment("a", "", "Let's use Kafka for order events.", false));
        doc.getComments().add(new NormalizedDocument.Comment("b", "", "Let's use Kafka for order events.", false));
        doc.getComments().add(new NormalizedDocument.Comment("c", "", "lets use kafka for order events", false));

        CompressedContext result = run(doc);
        long kafkaDecisions = result.getDecisions().stream().filter(d -> d.toLowerCase().contains("kafka")).count();
        assertEquals(1, kafkaDecisions, "repeats must collapse to one decision: " + result.getDecisions());
        assertTrue(result.getIgnoredContent().stream().anyMatch(i -> i.contains("duplicate")),
                "ignoredContent should report collapsed duplicates: " + result.getIgnoredContent());
    }

    @Test
    void tinyLevelKeepsOnlyHighValueContent() {
        NormalizedDocument doc = new NormalizedDocument();
        doc.setKey("ABC-4");
        doc.setTitle("Notifications");
        doc.setDescription("We decided to use Kafka for events.");
        doc.getComments().add(new NormalizedDocument.Comment("a", "",
                "I was on vacation last week, sorry for the slow reply. The weather was great by the way.", false));

        CompressedContext full = CompressionPipeline.standard().process(doc, CompressionLevel.FULL);
        CompressedContext tiny = CompressionPipeline.standard().process(doc, CompressionLevel.TINY);
        assertTrue(tiny.getCompressionRatio() >= full.getCompressionRatio(),
                "tiny must compress at least as hard as full");
        assertTrue(tiny.getDecisions().stream().anyMatch(d -> d.contains("Kafka")),
                "decisions must survive tiny compression");
    }
}
