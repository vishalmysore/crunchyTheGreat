package io.crunchy.core.stage;

import io.crunchy.core.model.CompressedContext;
import io.crunchy.core.pipeline.Block;
import io.crunchy.core.pipeline.PipelineStage;
import io.crunchy.core.pipeline.ProcessingContext;
import io.crunchy.core.text.TextUtil;

import java.util.LinkedHashSet;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Final stage: assembles the CIR document — summary, business goal,
 * architecture notes, related issues, ignored-content report, confidence and
 * the measured compression ratio.
 */
public final class AssemblyStage implements PipelineStage {

    private static final Pattern ISSUE_KEY = Pattern.compile("\\b([A-Z][A-Z0-9]{1,9}-\\d+)\\b");
    private static final Pattern BUSINESS_GOAL_SENTENCE = Pattern.compile(
            "(?i)\\b(so that|in order to|business goal|objective|the goal is)\\b");

    @Override
    public String name() {
        return "assembly";
    }

    @Override
    public void process(ProcessingContext context) {
        CompressedContext result = context.getResult();
        var document = context.getDocument();

        result.setIssue((document.getKey() + " " + document.getTitle()).strip());
        result.setSummary(buildSummary(context));
        result.setBusinessGoal(findBusinessGoal(context));
        collectArchitecture(context);
        collectRelatedIssues(context);
        result.getIgnoredContent().addAll(context.getIgnoredContent());
        result.setConfidence(confidence(result));
        result.setCompressionRatio(compressionRatio(context));
    }

    private String buildSummary(ProcessingContext context) {
        // First surviving description block, capped at two sentences.
        for (Block block : context.liveBlocks()) {
            if (block.getOrigin().equals("description")) {
                var sentences = TextUtil.sentences(block.getText());
                int take = Math.min(2, sentences.size());
                return String.join(" ", sentences.subList(0, take));
            }
        }
        return context.getDocument().getTitle();
    }

    private String findBusinessGoal(ProcessingContext context) {
        for (Block block : context.liveBlocks()) {
            for (String sentence : TextUtil.sentences(block.getText())) {
                if (BUSINESS_GOAL_SENTENCE.matcher(sentence).find()) {
                    return sentence;
                }
            }
        }
        return "";
    }

    private void collectArchitecture(ProcessingContext context) {
        for (Block block : context.liveBlocks()) {
            if (block.getCategories().contains(Block.Category.ARCHITECTURE)) {
                String text = block.getText();
                // Keep architecture entries sentence-sized, not whole paragraphs.
                for (String sentence : TextUtil.sentences(text)) {
                    if (context.getResult().getDecisions().stream()
                            .noneMatch(d -> d.equals(sentence))) {
                        continue;
                    }
                    addUnique(context, sentence);
                }
                if (context.getResult().getArchitecture().isEmpty()) {
                    addUnique(context, TextUtil.sentences(text).get(0));
                }
            }
        }
    }

    private void addUnique(ProcessingContext context, String value) {
        String normalized = TextUtil.normalizeForComparison(value);
        boolean exists = context.getResult().getArchitecture().stream()
                .anyMatch(v -> TextUtil.normalizeForComparison(v).equals(normalized));
        if (!exists) {
            context.getResult().getArchitecture().add(value);
        }
    }

    private void collectRelatedIssues(ProcessingContext context) {
        Set<String> keys = new LinkedHashSet<>();
        String ownKey = context.getDocument().getKey();
        Matcher inTitle = ISSUE_KEY.matcher(context.getDocument().getTitle());
        while (inTitle.find()) {
            keys.add(inTitle.group(1));
        }
        for (Block block : context.liveBlocks()) {
            Matcher m = ISSUE_KEY.matcher(block.getText());
            while (m.find()) {
                keys.add(m.group(1));
            }
        }
        String linked = context.getDocument().getMetadata().get("linkedIssues");
        if (linked != null && !linked.isBlank()) {
            for (String key : linked.split(",")) {
                keys.add(key.strip());
            }
        }
        keys.remove(ownKey);
        context.getResult().getRelatedIssues().addAll(keys);
    }

    private double confidence(CompressedContext result) {
        double confidence = 0.50;
        if (!result.getSummary().isBlank()) confidence += 0.10;
        if (!result.getDecisions().isEmpty()) confidence += 0.15;
        if (!result.getAcceptanceCriteria().isEmpty()) confidence += 0.15;
        if (!result.getBusinessGoal().isBlank()) confidence += 0.05;
        return Math.min(0.95, round2(confidence));
    }

    private double compressionRatio(ProcessingContext context) {
        int original = context.getDocument().rawLength();
        if (original == 0) {
            return 0.0;
        }
        int compressed = context.liveBlocks().stream()
                .mapToInt(b -> b.getText().length())
                .sum();
        return round2(Math.max(0.0, 1.0 - (double) compressed / original));
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
