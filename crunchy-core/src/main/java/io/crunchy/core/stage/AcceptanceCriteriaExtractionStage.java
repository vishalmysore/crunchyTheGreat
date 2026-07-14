package io.crunchy.core.stage;

import io.crunchy.core.pipeline.Block;
import io.crunchy.core.pipeline.PipelineStage;
import io.crunchy.core.pipeline.ProcessingContext;
import io.crunchy.core.text.TextUtil;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Stage 5: collects acceptance criteria from three shapes commonly found in
 * Jira — "Acceptance Criteria"/"Definition of Done" sections, Gherkin-style
 * Given/When/Then lines, and checkbox lists. Standalone "must/should"
 * requirement sentences are captured as constraints.
 */
public final class AcceptanceCriteriaExtractionStage implements PipelineStage {

    private static final Pattern SECTION_HEADING = Pattern.compile(
            "(?i)^\\s*(?:h\\d\\.\\s*|#{1,6}\\s*|\\*{0,2})\\s*(acceptance criteria|definition of done|dod)\\b.*$");
    private static final Pattern GHERKIN_LINE = Pattern.compile(
            "(?i)^\\s*(?:[-*]\\s*)?(given|when|then|and)\\b\\s+.+$");
    private static final Pattern LIST_ITEM = Pattern.compile(
            "^\\s*(?:[-*+]\\s*(?:\\[[ xX]\\]\\s*)?|\\d+[.)]\\s+)(.+)$");
    private static final Pattern REQUIREMENT_SENTENCE = Pattern.compile(
            "(?i)\\b(must(?: not)?|shall|should(?: not)?|is required to|has to)\\b");

    @Override
    public String name() {
        return "acceptance-criteria-extraction";
    }

    @Override
    public void process(ProcessingContext context) {
        for (Block block : context.getBlocks()) {
            if (block.isDropped()) {
                continue;
            }
            boolean found = extractFromSections(context, block);
            found |= extractGherkin(context, block);
            if (found) {
                block.getCategories().add(Block.Category.ACCEPTANCE_CRITERIA);
            }
            extractConstraints(context, block);
        }
    }

    private boolean extractFromSections(ProcessingContext context, Block block) {
        List<String> lines = block.getText().lines().toList();
        boolean inSection = false;
        boolean found = false;
        for (String line : lines) {
            if (SECTION_HEADING.matcher(line).matches()) {
                inSection = true;
                continue;
            }
            if (!inSection) {
                continue;
            }
            var item = LIST_ITEM.matcher(line);
            if (item.matches()) {
                addUnique(context.getResult().getAcceptanceCriteria(), item.group(1).strip());
                found = true;
            } else if (!line.isBlank() && !GHERKIN_LINE.matcher(line).matches()) {
                inSection = false; // prose after the list ends the section
            }
        }
        return found;
    }

    private boolean extractGherkin(ProcessingContext context, Block block) {
        StringBuilder scenario = new StringBuilder();
        boolean found = false;
        for (String line : block.getText().lines().toList()) {
            if (GHERKIN_LINE.matcher(line).matches()) {
                if (!scenario.isEmpty()) {
                    scenario.append(' ');
                }
                scenario.append(line.strip().replaceFirst("^[-*]\\s*", ""));
            } else if (!scenario.isEmpty()) {
                addUnique(context.getResult().getAcceptanceCriteria(), scenario.toString());
                scenario.setLength(0);
                found = true;
            }
        }
        if (!scenario.isEmpty()) {
            addUnique(context.getResult().getAcceptanceCriteria(), scenario.toString());
            found = true;
        }
        return found;
    }

    private void extractConstraints(ProcessingContext context, Block block) {
        for (String sentence : TextUtil.sentences(block.getText())) {
            if (REQUIREMENT_SENTENCE.matcher(sentence).find()
                    && !coveredByAcceptanceCriteria(context, sentence)) {
                block.getCategories().add(Block.Category.CONSTRAINT);
                addUnique(context.getResult().getConstraints(), sentence);
            }
        }
    }

    /** Avoids re-listing a requirement that already appears as an AC item. */
    private boolean coveredByAcceptanceCriteria(ProcessingContext context, String sentence) {
        String normalized = TextUtil.normalizeForComparison(sentence);
        return context.getResult().getAcceptanceCriteria().stream()
                .map(TextUtil::normalizeForComparison)
                .anyMatch(ac -> normalized.contains(ac) || ac.contains(normalized));
    }

    private void addUnique(List<String> target, String value) {
        String normalized = TextUtil.normalizeForComparison(value);
        boolean exists = target.stream()
                .anyMatch(v -> TextUtil.normalizeForComparison(v).equals(normalized));
        if (!exists) {
            target.add(value);
        }
    }
}
