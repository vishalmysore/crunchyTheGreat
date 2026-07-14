package io.crunchy.core.model;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;

import java.util.ArrayList;
import java.util.List;

/**
 * Context Intermediate Representation (CIR): the standardized JSON contract
 * consumed by AI agents, independent of which connector produced the input.
 */
@JsonPropertyOrder({
        "issue", "summary", "businessGoal", "architecture", "decisions",
        "constraints", "acceptanceCriteria", "risks", "todos", "dependencies",
        "relatedIssues", "ignoredContent", "confidence", "compressionRatio"
})
public final class CompressedContext {

    private String issue = "";
    private String summary = "";
    private String businessGoal = "";
    private final List<String> architecture = new ArrayList<>();
    private final List<String> decisions = new ArrayList<>();
    private final List<String> constraints = new ArrayList<>();
    private final List<String> acceptanceCriteria = new ArrayList<>();
    private final List<String> risks = new ArrayList<>();
    private final List<String> todos = new ArrayList<>();
    private final List<String> dependencies = new ArrayList<>();
    private final List<String> relatedIssues = new ArrayList<>();
    private final List<String> ignoredContent = new ArrayList<>();
    private double confidence;
    private double compressionRatio;

    public String getIssue() { return issue; }
    public void setIssue(String issue) { this.issue = issue; }

    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }

    public String getBusinessGoal() { return businessGoal; }
    public void setBusinessGoal(String businessGoal) { this.businessGoal = businessGoal; }

    public List<String> getArchitecture() { return architecture; }
    public List<String> getDecisions() { return decisions; }
    public List<String> getConstraints() { return constraints; }
    public List<String> getAcceptanceCriteria() { return acceptanceCriteria; }
    public List<String> getRisks() { return risks; }
    public List<String> getTodos() { return todos; }
    public List<String> getDependencies() { return dependencies; }
    public List<String> getRelatedIssues() { return relatedIssues; }
    public List<String> getIgnoredContent() { return ignoredContent; }

    public double getConfidence() { return confidence; }
    public void setConfidence(double confidence) { this.confidence = confidence; }

    public double getCompressionRatio() { return compressionRatio; }
    public void setCompressionRatio(double compressionRatio) { this.compressionRatio = compressionRatio; }
}
