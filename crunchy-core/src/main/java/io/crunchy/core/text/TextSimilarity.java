package io.crunchy.core.text;

import java.util.HashSet;
import java.util.Set;

/** Near-duplicate detection via Jaccard similarity over word sets. */
public final class TextSimilarity {

    public static final double NEAR_DUPLICATE_THRESHOLD = 0.75;

    private TextSimilarity() {}

    public static double jaccard(String a, String b) {
        Set<String> shinglesA = shingles(a);
        Set<String> shinglesB = shingles(b);
        if (shinglesA.isEmpty() && shinglesB.isEmpty()) {
            return TextUtil.normalizeForComparison(a).equals(TextUtil.normalizeForComparison(b)) ? 1.0 : 0.0;
        }
        if (shinglesA.isEmpty() || shinglesB.isEmpty()) {
            return 0.0;
        }
        Set<String> intersection = new HashSet<>(shinglesA);
        intersection.retainAll(shinglesB);
        Set<String> union = new HashSet<>(shinglesA);
        union.addAll(shinglesB);
        return (double) intersection.size() / union.size();
    }

    public static boolean nearDuplicate(String a, String b) {
        String na = TextUtil.normalizeForComparison(a);
        String nb = TextUtil.normalizeForComparison(b);
        if (na.equals(nb)) {
            return true;
        }
        // One text fully containing a short other text counts as a repeat.
        if (na.length() > 20 && nb.length() > 20 && (na.contains(nb) || nb.contains(na))) {
            return true;
        }
        return jaccard(a, b) >= NEAR_DUPLICATE_THRESHOLD;
    }

    private static Set<String> shingles(String text) {
        String normalized = TextUtil.normalizeForComparison(text);
        Set<String> words = new HashSet<>();
        if (!normalized.isEmpty()) {
            for (String word : normalized.split(" ")) {
                words.add(word);
            }
        }
        return words;
    }
}
