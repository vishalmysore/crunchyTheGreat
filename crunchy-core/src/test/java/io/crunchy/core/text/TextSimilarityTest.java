package io.crunchy.core.text;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TextSimilarityTest {

    @Test
    void exactDuplicatesMatch() {
        assertTrue(TextSimilarity.nearDuplicate("Let's use Kafka.", "let's use kafka"));
    }

    @Test
    void nearDuplicatesMatch() {
        assertTrue(TextSimilarity.nearDuplicate(
                "For the event backbone we should use Kafka because it already runs in production.",
                "For the event backbone we should use Kafka since it already runs in production."));
    }

    @Test
    void differentStatementsDoNotMatch() {
        assertFalse(TextSimilarity.nearDuplicate(
                "We should cap concurrent deliveries per merchant.",
                "All notification payloads are signed with HMAC-SHA256."));
    }
}
