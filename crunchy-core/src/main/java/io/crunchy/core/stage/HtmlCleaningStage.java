package io.crunchy.core.stage;

import io.crunchy.core.pipeline.PipelineStage;
import io.crunchy.core.pipeline.ProcessingContext;
import io.crunchy.core.pipeline.SourceText;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;

import java.util.regex.Pattern;

/**
 * Stage 2 (cleaning): HTML → plain text, then strip email quotes, signatures
 * and whitespace noise. Runs on every source text before block splitting.
 */
public final class HtmlCleaningStage implements PipelineStage {

    private static final Pattern HTML_HINT = Pattern.compile("<\\s*(p|div|br|span|table|ul|ol|li|b|i|strong|em|h[1-6]|a)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern EMAIL_QUOTE_HEADER = Pattern.compile("(?im)^On .{5,120} wrote:\\s*$");
    private static final Pattern QUOTED_LINE = Pattern.compile("(?m)^\\s*>.*$");
    private static final Pattern SIGNATURE = Pattern.compile("(?s)(?m)^--\\s*$.*");
    private static final Pattern EXCESS_BLANK_LINES = Pattern.compile("\\n{3,}");
    private static final Pattern TRAILING_SPACES = Pattern.compile("(?m)[ \\t]+$");

    @Override
    public String name() {
        return "html-cleaning";
    }

    @Override
    public void process(ProcessingContext context) {
        for (SourceText source : context.getSources()) {
            source.setText(clean(source.getText()));
        }
    }

    static String clean(String raw) {
        String text = raw;
        if (HTML_HINT.matcher(text).find()) {
            // Preserve line structure: mark block boundaries with a sentinel that
            // survives Jsoup's whitespace normalization, then restore newlines.
            Document doc = Jsoup.parse(text);
            doc.select("br").after("\\n");
            // Wrapping block tags on both sides puts a blank line between
            // adjacent paragraphs, so <p>A</p><p>B</p> stays two blocks.
            doc.select("p, div, tr, h1, h2, h3, h4, h5, h6").prepend("\\n").append("\\n");
            // List items only close with a newline (never open with one), so a
            // heading stays in the same block as the list it introduces — the
            // acceptance-criteria section extractor depends on that. <ul>/<ol>
            // deliberately contribute no break for the same reason.
            doc.select("li").prepend("- ").append("\\n");
            text = doc.text().replace("\\n", "\n");
        }
        // Drop everything from an email-quote header onward.
        var quoteHeader = EMAIL_QUOTE_HEADER.matcher(text);
        if (quoteHeader.find()) {
            text = text.substring(0, quoteHeader.start());
        }
        text = QUOTED_LINE.matcher(text).replaceAll("");
        text = SIGNATURE.matcher(text).replaceAll("");
        text = TRAILING_SPACES.matcher(text).replaceAll("");
        text = EXCESS_BLANK_LINES.matcher(text).replaceAll("\n\n");
        return text.strip();
    }
}
