package io.crunchy.core.text;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

public final class TextUtil {

    // Newlines always end a sentence: Jira content is line-structured (list
    // items, Gherkin lines) and rarely punctuated at line ends.
    private static final Pattern SENTENCE_SPLIT =
            Pattern.compile("(?<=[.!?])\\s+(?=[A-Z\"'(\\[])|\\n+");
    private static final Pattern NON_WORD = Pattern.compile("[^a-z0-9 ]");
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");

    private TextUtil() {}

    /** Lowercase, strip punctuation, collapse whitespace — for comparisons only. */
    public static String normalizeForComparison(String text) {
        // Apostrophes are deleted (not spaced) so "let's" and "lets" compare equal.
        String lower = text.toLowerCase(Locale.ROOT).replace("'", "").replace("’", "");
        return WHITESPACE.matcher(NON_WORD.matcher(lower).replaceAll(" ")).replaceAll(" ").trim();
    }

    public static List<String> sentences(String paragraph) {
        List<String> out = new ArrayList<>();
        for (String s : SENTENCE_SPLIT.split(paragraph.strip())) {
            if (!s.isBlank()) {
                out.add(s.strip());
            }
        }
        return out;
    }

    /** True when the text looks like a log dump or stack trace rather than prose. */
    public static boolean looksLikeLogDump(String text) {
        String[] lines = text.split("\\R");
        if (lines.length < 3) {
            return false;
        }
        int logLike = 0;
        for (String line : lines) {
            String t = line.strip();
            if (t.isEmpty()) {
                continue;
            }
            if (t.startsWith("at ") || t.startsWith("Caused by:")
                    || t.matches("^\\d{4}-\\d{2}-\\d{2}[T ].*")
                    || t.matches("^\\[?(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\\]?\\b.*")
                    || t.matches("^\\w+(\\.\\w+)+(Exception|Error)(:.*)?")) {
                logLike++;
            }
        }
        return logLike >= Math.max(3, (int) (lines.length * 0.5));
    }
}
