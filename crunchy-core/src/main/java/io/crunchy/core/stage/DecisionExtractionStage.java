package io.crunchy.core.stage;

import io.crunchy.core.pipeline.Block;
import io.crunchy.core.pipeline.PipelineStage;
import io.crunchy.core.pipeline.ProcessingContext;
import io.crunchy.core.text.TextUtil;

import java.util.regex.Pattern;

/**
 * Stage 4: pulls architecture/technology decisions out of prose. Sentences
 * matching a decision pattern land in {@code decisions}; explicit rejections
 * are kept too ("Rejected: Memcached") because knowing what NOT to use is as
 * valuable to a coding agent as knowing what to use.
 */
public final class DecisionExtractionStage implements PipelineStage {

    private static final Pattern DECISION = Pattern.compile(
            "(?i)\\b(decided to|decision:|final decision|we(?:'ll| will| should) (?:use|go with|adopt|switch to)|"
                    + "let'?s (?:use|go with|adopt)|going with|agreed (?:on|to)|we chose|settled on)\\b");
    private static final Pattern REJECTION = Pattern.compile(
            "(?i)\\b(rejected|won'?t use|will not use|ruled out|decided against|dropping|not going with|instead of)\\b");
    private static final Pattern ARCHITECTURE_HINT = Pattern.compile(
            "(?i)\\b(architecture|service|microservice|gateway|queue|topic|database|schema|cache|endpoint|"
                    + "api|event|stream|partition|shard|cluster|deployment|container)\\b");

    @Override
    public String name() {
        return "decision-extraction";
    }

    @Override
    public void process(ProcessingContext context) {
        for (Block block : context.getBlocks()) {
            if (block.isDropped()) {
                continue;
            }
            for (String sentence : TextUtil.sentences(block.getText())) {
                boolean decision = DECISION.matcher(sentence).find();
                boolean rejection = REJECTION.matcher(sentence).find();
                if (decision || rejection) {
                    block.getCategories().add(Block.Category.DECISION);
                    addUnique(context, sentence);
                }
                if ((decision || rejection) && ARCHITECTURE_HINT.matcher(sentence).find()) {
                    block.getCategories().add(Block.Category.ARCHITECTURE);
                }
            }
        }
    }

    private void addUnique(ProcessingContext context, String sentence) {
        String normalized = TextUtil.normalizeForComparison(sentence);
        boolean exists = context.getResult().getDecisions().stream()
                .anyMatch(d -> TextUtil.normalizeForComparison(d).equals(normalized));
        if (!exists) {
            context.getResult().getDecisions().add(sentence);
        }
    }
}
