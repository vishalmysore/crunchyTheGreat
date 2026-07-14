package io.crunchy.core.stage;

import io.crunchy.core.pipeline.PipelineStage;
import io.crunchy.core.pipeline.ProcessingContext;
import io.crunchy.core.pipeline.SourceText;
import io.crunchy.core.text.TextUtil;

import java.util.regex.Pattern;

/**
 * Removes whole source texts that carry no engineering signal: bot chatter,
 * greetings/acknowledgements, emoji spam and raw log dumps.
 */
public final class NoiseFilterStage implements PipelineStage {

    private static final Pattern BOT_AUTHOR = Pattern.compile(
            "(?i)\\b(bot|jenkins|automation|pipeline|github-actions|dependabot|sonar)\\b");
    private static final Pattern BOT_BODY = Pattern.compile(
            "(?i)^(build\\s+#?\\d+\\s+(started|succeeded|failed|passed)|deployment\\s+(started|completed|triggered)|branch\\s+\\S+\\s+was\\s+(created|deleted)).*");
    private static final Pattern GREETING_ONLY = Pattern.compile(
            "(?i)^(?:(?:hi|hello|hey)(?: (?:team|all|everyone|folks|guys))?|thanks|thank you|thx|ty|\\+1|lgtm|ok|okay|sounds good|got it|noted|any update\\??|ping|bump)[\\s!.,]*$");
    private static final Pattern EMOJI_OR_SYMBOL = Pattern.compile(
            "[\\p{So}\\p{Sk}\\p{Cs}:;()\\[\\]{}\\-_*+~^\\s]+");

    @Override
    public String name() {
        return "noise-filter";
    }

    @Override
    public void process(ProcessingContext context) {
        int bots = 0;
        int greetings = 0;
        int logDumps = 0;
        int emoji = 0;
        for (SourceText source : context.getSources()) {
            if (source.isRemoved() || source.getOrigin().equals("description")) {
                continue;
            }
            String text = source.getText();
            if (text.isBlank()) {
                source.remove("empty");
                continue;
            }
            if (source.isBot() || BOT_AUTHOR.matcher(source.getAuthor()).find() || BOT_BODY.matcher(text.strip()).matches()) {
                source.remove("bot message");
                bots++;
            } else if (GREETING_ONLY.matcher(text.strip()).matches()) {
                source.remove("greeting/acknowledgement");
                greetings++;
            } else if (EMOJI_OR_SYMBOL.matcher(text).matches()) {
                source.remove("emoji/symbol spam");
                emoji++;
            } else if (TextUtil.looksLikeLogDump(text)) {
                source.remove("log dump");
                logDumps++;
                context.getIgnoredContent().add(
                        "Log/stack-trace dump removed from " + source.getOrigin()
                                + " (" + text.length() + " chars)");
            }
        }
        if (bots > 0) {
            context.getIgnoredContent().add(bots + " bot message(s) removed");
        }
        if (greetings > 0) {
            context.getIgnoredContent().add(greetings + " greeting/acknowledgement comment(s) removed");
        }
        if (emoji > 0) {
            context.getIgnoredContent().add(emoji + " emoji-only comment(s) removed");
        }
    }
}
