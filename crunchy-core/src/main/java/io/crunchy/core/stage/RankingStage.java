package io.crunchy.core.stage;

import io.crunchy.core.pipeline.Block;
import io.crunchy.core.pipeline.PipelineStage;
import io.crunchy.core.pipeline.ProcessingContext;
import io.crunchy.core.pipeline.Weights;
import io.crunchy.core.text.TextUtil;

import java.util.regex.Pattern;

/**
 * Stage 8: every block gets a value score; blocks under the compression
 * level's threshold are dropped. This governs the prose-derived fields
 * (summary, business goal, architecture); the assembly stage gates the
 * extracted CIR lists by the same thresholds.
 */
public final class RankingStage implements PipelineStage {

    private static final Pattern BUSINESS_GOAL = Pattern.compile(
            "(?i)\\b(so that|in order to|business goal|objective|the goal is|customers? (?:want|need)|revenue|compliance)\\b");

    @Override
    public String name() {
        return "ranking";
    }

    @Override
    public void process(ProcessingContext context) {
        int dropped = 0;
        for (Block block : context.getBlocks()) {
            if (block.isDropped()) {
                continue;
            }
            if (BUSINESS_GOAL.matcher(block.getText()).find()) {
                block.getCategories().add(Block.Category.BUSINESS_GOAL);
            }
            if (TextUtil.looksLikeLogDump(block.getText())) {
                block.getCategories().add(Block.Category.NOISE);
            }
            if (block.getCategories().isEmpty()) {
                block.getCategories().add(Block.Category.DISCUSSION);
            }
            block.setScore(score(block));
            if (block.getScore() < context.getLevel().threshold()) {
                block.drop("below rank threshold (" + block.getScore() + ")");
                dropped++;
            }
        }
        if (dropped > 0) {
            context.getIgnoredContent().add(
                    dropped + " low-value paragraph(s) dropped below the "
                            + context.getLevel().name().toLowerCase() + " threshold");
        }
    }

    private double score(Block block) {
        double best = block.getCategories().stream()
                .mapToDouble(Weights::of)
                .max()
                .orElse(Weights.DEFAULT_WEIGHT);
        if (block.getCategories().contains(Block.Category.NOISE)) {
            return Weights.of(Block.Category.NOISE);
        }
        // Repetition is an emphasis signal: a point made three times mattered
        // to the team even if phrased as plain discussion.
        double repetitionBoost = Math.min(0.10, (block.getDuplicateCount() - 1) * 0.05);
        return Math.min(0.99, best + repetitionBoost);
    }
}
