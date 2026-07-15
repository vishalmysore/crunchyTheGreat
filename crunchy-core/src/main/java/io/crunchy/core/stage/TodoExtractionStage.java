package io.crunchy.core.stage;

import io.crunchy.core.pipeline.Block;
import io.crunchy.core.pipeline.PipelineStage;
import io.crunchy.core.pipeline.ProcessingContext;
import io.crunchy.core.text.TextUtil;

import java.util.regex.Pattern;

/** Stage 6: open work items — TODO/FIXME markers and follow-up phrasing. */
public final class TodoExtractionStage implements PipelineStage {

    private static final Pattern TODO = Pattern.compile(
            "(?i)\\b(todo|fixme|follow[- ]up|still pending|remaining work|remains to|"
                    + "yet to be|we still need|need(?:s)? to (?:add|implement|write|update|fix|migrate|document|test))\\b");

    @Override
    public String name() {
        return "todo-extraction";
    }

    @Override
    public void process(ProcessingContext context) {
        for (Block block : context.getBlocks()) {
            if (block.isDropped()) {
                continue;
            }
            for (String sentence : TextUtil.sentences(block.getText())) {
                if (TODO.matcher(sentence).find()) {
                    String cleaned = sentence.replaceFirst("(?i)^(todo|fixme)\\s*[:\\-]\\s*", "");
                    context.addExtract(ProcessingContext.CirList.TODOS, cleaned,
                            Block.Category.TODO, block);
                }
            }
        }
    }
}
