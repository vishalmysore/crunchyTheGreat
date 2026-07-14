package io.crunchy.core.stage;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class HtmlCleaningStageTest {

    @Test
    void stripsHtmlButKeepsBlockStructure() {
        String cleaned = HtmlCleaningStage.clean(
                "<p>First paragraph</p><ul><li>item one</li><li>item two</li></ul>");
        assertTrue(cleaned.contains("First paragraph"));
        assertTrue(cleaned.contains("item one"));
        assertFalse(cleaned.contains("<"));
        // items must not be glued into one line-less blob
        assertTrue(cleaned.lines().count() >= 3);
    }

    @Test
    void dropsEmailQuotesAndSignatures() {
        String cleaned = HtmlCleaningStage.clean(
                "We should retry failed deliveries.\n"
                        + "On Tue, May 3, 2026 at 9:00 AM Priya Nair wrote:\n"
                        + "> earlier reply text\n"
                        + "> more quoted text\n");
        assertEquals("We should retry failed deliveries.", cleaned);
    }

    @Test
    void plainTextPassesThroughUnchanged() {
        assertEquals("Just plain text.", HtmlCleaningStage.clean("Just plain text."));
    }
}
