package io.crunchy.core.pipeline;

import java.util.Map;

/**
 * Value score per content category, shared by the ranking stage (which scores
 * blocks) and the assembly stage (which gates CIR sections by compression
 * level). Mirrors the design targets: decisions 0.98, acceptance criteria
 * 0.96, business goals 0.94, plain discussion 0.50, noise ~0.
 */
public final class Weights {

    public static final double DEFAULT_WEIGHT = 0.4;

    private static final Map<Block.Category, Double> WEIGHTS = Map.of(
            Block.Category.DECISION, 0.98,
            Block.Category.ACCEPTANCE_CRITERIA, 0.96,
            Block.Category.BUSINESS_GOAL, 0.94,
            Block.Category.ARCHITECTURE, 0.90,
            Block.Category.CONSTRAINT, 0.88,
            Block.Category.RISK, 0.85,
            Block.Category.DEPENDENCY, 0.82,
            Block.Category.TODO, 0.78,
            Block.Category.DISCUSSION, 0.50,
            Block.Category.NOISE, 0.01
    );

    private Weights() {}

    public static double of(Block.Category category) {
        return WEIGHTS.getOrDefault(category, DEFAULT_WEIGHT);
    }
}
