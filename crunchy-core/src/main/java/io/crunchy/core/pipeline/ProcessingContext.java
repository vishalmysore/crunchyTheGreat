package io.crunchy.core.pipeline;

import io.crunchy.core.model.CompressedContext;
import io.crunchy.core.model.CompressionLevel;
import io.crunchy.core.model.NormalizedDocument;

import java.util.ArrayList;
import java.util.List;

/** Shared state passed through every pipeline stage. */
public final class ProcessingContext {

    private final NormalizedDocument document;
    private final CompressionLevel level;
    private final List<SourceText> sources = new ArrayList<>();
    private final List<Block> blocks = new ArrayList<>();
    private final CompressedContext result = new CompressedContext();
    private final List<String> ignoredContent = new ArrayList<>();

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

    /** Blocks that survived filtering, deduplication and ranking. */
    public List<Block> liveBlocks() {
        return blocks.stream().filter(b -> !b.isDropped()).toList();
    }
}
