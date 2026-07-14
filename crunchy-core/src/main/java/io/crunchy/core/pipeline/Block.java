package io.crunchy.core.pipeline;

import java.util.EnumSet;
import java.util.Set;

/** A paragraph-level unit of content flowing through the pipeline. */
public final class Block {

    public enum Category {
        DECISION, ACCEPTANCE_CRITERIA, BUSINESS_GOAL, ARCHITECTURE,
        CONSTRAINT, RISK, DEPENDENCY, TODO, DISCUSSION, NOISE
    }

    private String text;
    private final String origin;   // "description" or "comment:<index>"
    private final String author;
    private final Set<Category> categories = EnumSet.noneOf(Category.class);
    private double score;
    private int duplicateCount = 1;
    private boolean dropped;
    private String dropReason;

    public Block(String text, String origin, String author) {
        this.text = text;
        this.origin = origin;
        this.author = author;
    }

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }

    public String getOrigin() { return origin; }
    public String getAuthor() { return author; }

    public Set<Category> getCategories() { return categories; }

    public double getScore() { return score; }
    public void setScore(double score) { this.score = score; }

    public int getDuplicateCount() { return duplicateCount; }
    public void incrementDuplicates() { this.duplicateCount++; }

    public boolean isDropped() { return dropped; }
    public String getDropReason() { return dropReason; }

    public void drop(String reason) {
        this.dropped = true;
        this.dropReason = reason;
    }
}
