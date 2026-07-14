package io.crunchy.core.stage;

import io.crunchy.core.pipeline.Block;
import io.crunchy.core.pipeline.PipelineStage;
import io.crunchy.core.pipeline.ProcessingContext;
import io.crunchy.core.pipeline.SourceText;

/**
 * Splits every surviving source text into paragraph blocks. List items stay
 * attached to the paragraph that introduces them so that extraction stages see
 * headings ("Acceptance Criteria") together with their items.
 */
public final class BlockSplittingStage implements PipelineStage {

    @Override
    public String name() {
        return "block-splitting";
    }

    @Override
    public void process(ProcessingContext context) {
        for (SourceText source : context.getSources()) {
            if (source.isRemoved()) {
                continue;
            }
            for (String paragraph : source.getText().split("\\n\\s*\\n")) {
                String trimmed = paragraph.strip();
                if (!trimmed.isEmpty()) {
                    context.getBlocks().add(new Block(trimmed, source.getOrigin(), source.getAuthor()));
                }
            }
        }
    }
}
