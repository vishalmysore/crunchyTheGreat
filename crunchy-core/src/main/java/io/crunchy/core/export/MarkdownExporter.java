package io.crunchy.core.export;

import io.crunchy.core.model.CompressedContext;

import java.util.List;

/**
 * Renders the CIR as compact Markdown, ready to paste into an agent prompt.
 *
 * <p>{@code ignoredContent} is deliberately omitted: it is a diagnostic for
 * humans auditing what was removed, and an agent should not spend context
 * reading "3 greetings removed". It remains available in the JSON CIR.
 */
public final class MarkdownExporter {

    public String export(CompressedContext c) {
        StringBuilder md = new StringBuilder();
        md.append("# ").append(c.getIssue()).append("\n\n");
        if (!c.getSummary().isBlank()) {
            md.append(c.getSummary()).append("\n\n");
        }
        if (!c.getBusinessGoal().isBlank()) {
            md.append("**Business goal:** ").append(c.getBusinessGoal()).append("\n\n");
        }
        section(md, "Architecture", c.getArchitecture());
        section(md, "Decisions", c.getDecisions());
        section(md, "Constraints", c.getConstraints());
        section(md, "Acceptance Criteria", c.getAcceptanceCriteria());
        section(md, "Risks", c.getRisks());
        section(md, "TODOs", c.getTodos());
        section(md, "Dependencies", c.getDependencies());
        section(md, "Related Issues", c.getRelatedIssues());
        md.append("---\n")
          .append("confidence: ").append(c.getConfidence())
          .append(" | compression: ").append(Math.round(c.getCompressionRatio() * 100)).append("%\n");
        return md.toString();
    }

    private void section(StringBuilder md, String title, List<String> items) {
        if (items.isEmpty()) {
            return;
        }
        md.append("## ").append(title).append("\n");
        for (String item : items) {
            md.append("- ").append(item).append("\n");
        }
        md.append("\n");
    }
}
