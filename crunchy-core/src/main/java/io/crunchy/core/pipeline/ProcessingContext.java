package io.crunchy.core.pipeline;

import io.crunchy.core.model.CompressedContext;
import io.crunchy.core.model.CompressionLevel;
import io.crunchy.core.model.NormalizedDocument;

import java.util.ArrayList;
import java.util.List;

/** Shared state passed through every pipeline stage. */
public final class ProcessingContext {

    /** The CIR list an extracted sentence belongs to. */
    public enum CirList {
        DECISIONS, CONSTRAINTS, ACCEPTANCE_CRITERIA, RISKS, TODOS, DEPENDENCIES
    }

    /**
     * One extracted sentence, tagged with the category that determines its
     * value score. Extraction records these instead of writing straight into
     * the result, so the assembly stage can gate them by compression level.
     */
    public record Extract(CirList list, String text, Block.Category category, Block block) {}

    private final NormalizedDocument document;
    private final CompressionLevel level;
    private final List<SourceText> sources = new ArrayList<>();
    private final List<Block> blocks = new ArrayList<>();
    private final CompressedContext result = new CompressedContext();
    private final List<String> ignoredContent = new ArrayList<>();
    private final List<Extract> extracts = new ArrayList<>();

    public ProcessingContext(NormalizedDocument document, CompressionLevel level) {
        this.document = document;
        this.level = level;
        sources.add(new SourceText("description", "", false, document.getDescription()));
        List<NormalizedDocument.Comment> comments = document.getComments();
        for (int i = 0; i < comments.size(); i++) {
            NormalizedDocument.Comment c = comments.get(i);
            sources.add(new SourceText("comment:" + (i + 1), c.author(), c.bot(), c.body()));
        }
    }

    public NormalizedDocument getDocument() { return document; }
    public CompressionLevel getLevel() { return level; }
    public List<SourceText> getSources() { return sources; }
    public List<Block> getBlocks() { return blocks; }
    public CompressedContext getResult() { return result; }
    public List<String> getIgnoredContent() { return ignoredContent; }

    public List<Extract> getExtracts() { return extracts; }

    /** Records an extracted sentence and tags its source block's category. */
    public void addExtract(CirList list, String text, Block.Category category, Block block) {
        block.getCategories().add(category);
        extracts.add(new Extract(list, text, category, block));
    }

    /** Blocks that survived filtering, deduplication and ranking. */
    public List<Block> liveBlocks() {
        return blocks.stream().filter(b -> !b.isDropped()).toList();
    }
}
