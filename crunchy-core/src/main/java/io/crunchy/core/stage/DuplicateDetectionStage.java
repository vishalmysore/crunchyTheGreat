package io.crunchy.core.stage;

import io.crunchy.core.pipeline.Block;
import io.crunchy.core.pipeline.PipelineStage;
import io.crunchy.core.pipeline.ProcessingContext;
import io.crunchy.core.text.TextSimilarity;

import java.util.ArrayList;
import java.util.List;

/**
 * Stage 3: exact and near-duplicate blocks collapse into the first occurrence,
 * which records how often the point was repeated (a useful emphasis signal for
 * ranking).
 */
public final class DuplicateDetectionStage implements PipelineStage {

    @Override
    public String name() {
        return "duplicate-detection";
    }

    @Override
    public void process(ProcessingContext context) {
        List<Block> kept = new ArrayList<>();
        int duplicates = 0;
        for (Block block : context.getBlocks()) {
            if (block.isDropped()) {
                continue;
            }
            Block original = findDuplicate(kept, block);
            if (original != null) {
                original.incrementDuplicates();
                block.drop("duplicate of " + original.getOrigin());
                duplicates++;
            } else {
                kept.add(block);
            }
        }
        if (duplicates > 0) {
            context.getIgnoredContent().add(duplicates + " duplicate/near-duplicate paragraph(s) collapsed");
        }
    }

    private Block findDuplicate(List<Block> kept, Block candidate) {
        for (Block existing : kept) {
            if (TextSimilarity.nearDuplicate(existing.getText(), candidate.getText())) {
                return existing;
            }
        }
        return null;
    }
}
