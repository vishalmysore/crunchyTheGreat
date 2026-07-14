package io.crunchy.connector.jira;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.crunchy.core.model.NormalizedDocument;

import java.io.IOException;
import java.io.InputStream;
import java.util.StringJoiner;
import java.util.regex.Pattern;

/**
 * Parses a Jira REST API v2 issue payload (GET /rest/api/2/issue/{key}
 * with comments expanded) into a {@link NormalizedDocument}. Works from a
 * saved JSON export too, so the pipeline can run without Jira credentials.
 */
public final class JiraIssueParser {

    private static final Pattern BOT_AUTHOR = Pattern.compile(
            "(?i)\\b(bot|jenkins|automation|pipeline|github|dependabot|sonar|bamboo)\\b");

    private final ObjectMapper mapper = new ObjectMapper();

    public NormalizedDocument parse(InputStream json) throws IOException {
        return parse(mapper.readTree(json));
    }

    public NormalizedDocument parse(String json) throws IOException {
        return parse(mapper.readTree(json));
    }

    public NormalizedDocument parse(JsonNode root) {
        NormalizedDocument doc = new NormalizedDocument();
        doc.setSource("jira");
        doc.setKey(root.path("key").asText(""));

        JsonNode fields = root.path("fields");
        doc.setTitle(fields.path("summary").asText(""));
        doc.setDescription(textOrRendered(root, fields, "description"));

        copyMetadata(fields, doc);
        parseComments(root, fields, doc);
        parseLinks(fields, doc);
        return doc;
    }

    /** Prefer the raw field; fall back to renderedFields HTML (the cleaner strips tags). */
    private String textOrRendered(JsonNode root, JsonNode fields, String field) {
        String raw = fields.path(field).asText("");
        if (!raw.isBlank()) {
            return raw;
        }
        return root.path("renderedFields").path(field).asText("");
    }

    private void copyMetadata(JsonNode fields, NormalizedDocument doc) {
        putIfPresent(doc, "status", fields.path("status").path("name").asText(""));
        putIfPresent(doc, "issueType", fields.path("issuetype").path("name").asText(""));
        putIfPresent(doc, "priority", fields.path("priority").path("name").asText(""));
        putIfPresent(doc, "assignee", fields.path("assignee").path("displayName").asText(""));
        if (fields.path("labels").isArray() && !fields.path("labels").isEmpty()) {
            StringJoiner labels = new StringJoiner(",");
            fields.path("labels").forEach(l -> labels.add(l.asText()));
            doc.getMetadata().put("labels", labels.toString());
        }
    }

    private void parseComments(JsonNode root, JsonNode fields, NormalizedDocument doc) {
        JsonNode comments = fields.path("comment").path("comments");
        if (!comments.isArray()) {
            comments = root.path("comment").path("comments");
        }
        for (JsonNode comment : comments) {
            String author = comment.path("author").path("displayName").asText(
                    comment.path("author").path("name").asText(""));
            String accountType = comment.path("author").path("accountType").asText("");
            boolean bot = "app".equalsIgnoreCase(accountType) || BOT_AUTHOR.matcher(author).find();
            doc.getComments().add(new NormalizedDocument.Comment(
                    author,
                    comment.path("created").asText(""),
                    comment.path("body").asText(""),
                    bot));
        }
    }

    private void parseLinks(JsonNode fields, NormalizedDocument doc) {
        JsonNode links = fields.path("issuelinks");
        if (!links.isArray() || links.isEmpty()) {
            return;
        }
        StringJoiner keys = new StringJoiner(",");
        for (JsonNode link : links) {
            String key = link.path("outwardIssue").path("key").asText(
                    link.path("inwardIssue").path("key").asText(""));
            if (!key.isBlank()) {
                keys.add(key);
            }
        }
        if (keys.length() > 0) {
            doc.getMetadata().put("linkedIssues", keys.toString());
        }
    }

    private void putIfPresent(NormalizedDocument doc, String key, String value) {
        if (value != null && !value.isBlank()) {
            doc.getMetadata().put(key, value);
        }
    }
}
