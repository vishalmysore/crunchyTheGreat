package io.crunchy.core.model;

/**
 * How aggressively low-scoring content is discarded. The threshold is the
 * minimum value score content needs to survive into the compressed output,
 * and it gates whole CIR sections by category weight:
 *
 * <pre>
 *   TINY   0.90  decisions + acceptance criteria (the irreducible brief)
 *   SMALL  0.86  + constraints
 *   MEDIUM 0.84  + risks
 *   FULL   0.00  + dependencies, todos — everything except detected noise
 * </pre>
 */
public enum CompressionLevel {
    TINY(0.90),
    SMALL(0.86),
    MEDIUM(0.84),
    FULL(0.0);

    private final double threshold;

    CompressionLevel(double threshold) {
        this.threshold = threshold;
    }

    public double threshold() {
        return threshold;
    }
}
