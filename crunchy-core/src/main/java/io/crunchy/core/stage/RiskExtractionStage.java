package io.crunchy.core.stage;

import io.crunchy.core.pipeline.Block;
import io.crunchy.core.pipeline.PipelineStage;
import io.crunchy.core.pipeline.ProcessingContext;
import io.crunchy.core.text.TextUtil;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Stage 7: surfaces risks (security, performance, migration, known issues)
 * and hard dependencies/blockers as separate CIR lists.
 */
public final class RiskExtractionStage implements PipelineStage {

    private static final Pattern RISK = Pattern.compile(
            "(?i)\\b(risk|risky|security|vulnerab\\w+|injection|xss|csrf|data loss|race condition|"
                    + "performance|latency|slow|memory leak|timeout|scalab\\w+|migration|breaking change|"
                    + "known issue|tech debt|concern|caveat|edge case|backwards? compat\\w*)\\b");
    private static final Pattern DEPENDENCY = Pattern.compile(
            "(?i)\\b(depends on|dependency|blocked (?:by|on)|blocker|waiting (?:on|for)|requires? (?:the )?"
                    + "(?:[A-Z][\\w-]+ )?(?:team|service|api|library|upgrade|approval))\\b");

    @Override
    public String name() {
        return "risk-extraction";
    }

    @Override
    public void process(ProcessingContext context) {
        for (Block block : context.getBlocks()) {
            if (block.isDropped()) {
                continue;
            }
            for (String sentence : TextUtil.sentences(block.getText())) {
                if (DEPENDENCY.matcher(sentence).find()) {
                    block.getCategories().add(Block.Category.DEPENDENCY);
                    addUnique(context.getResult().getDependencies(), sentence);
                } else if (RISK.matcher(sentence).find()) {
                    block.getCategories().add(Block.Category.RISK);
                    addUnique(context.getResult().getRisks(), sentence);
                }
            }
        }
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
