package io.crunchy.core.model;

/**
 * How aggressively low-scoring content is discarded. The threshold is the
 * minimum rank score a block needs to survive into the compressed output.
 */
public enum CompressionLevel {
    TINY(0.90),
    SMALL(0.75),
    MEDIUM(0.50),
    FULL(0.0);

    private final double threshold;

    CompressionLevel(double threshold) {
        this.threshold = threshold;
    }

    public double threshold() {
        return threshold;
    }
}
