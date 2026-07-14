package io.crunchy.core.model;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Source-agnostic representation of a work item. Every connector (Jira, GitHub
 * Issues, Azure DevOps, ...) produces this shape; the pipeline only ever sees
 * this class, never a source-specific payload.
 */
public final class NormalizedDocument {

    private String source = "unknown";
    private String key = "";
    private String title = "";
    private String description = "";
    private final List<Comment> comments = new ArrayList<>();
    private final Map<String, String> metadata = new LinkedHashMap<>();

    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }

    public String getKey() { return key; }
    public void setKey(String key) { this.key = key; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description == null ? "" : description; }

    public List<Comment> getComments() { return comments; }

    public Map<String, String> getMetadata() { return metadata; }

    /** Total characters of raw content, used as the denominator of the compression ratio. */
    public int rawLength() {
        int len = title.length() + description.length();
        for (Comment c : comments) {
            len += c.body().length();
        }
        return len;
    }

    public record Comment(String author, String created, String body, boolean bot) {
        public Comment {
            author = author == null ? "" : author;
            created = created == null ? "" : created;
            body = body == null ? "" : body;
        }
    }
}
