package io.crunchy.core.pipeline;

/**
 * A mutable working copy of one raw text unit (the description or a single
 * comment). Cleaning stages rewrite {@code text}; filter stages mark the whole
 * unit removed before it is ever split into blocks.
 */
public final class SourceText {

    private final String origin;   // "description" or "comment:<index>"
    private final String author;
    private final boolean bot;
    private String text;
    private boolean removed;
    private String removalReason;

    public SourceText(String origin, String author, boolean bot, String text) {
        this.origin = origin;
        this.author = author;
        this.bot = bot;
        this.text = text == null ? "" : text;
    }

    public String getOrigin() { return origin; }
    public String getAuthor() { return author; }
    public boolean isBot() { return bot; }

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }

    public boolean isRemoved() { return removed; }
    public String getRemovalReason() { return removalReason; }

    public void remove(String reason) {
        this.removed = true;
        this.removalReason = reason;
    }
}
