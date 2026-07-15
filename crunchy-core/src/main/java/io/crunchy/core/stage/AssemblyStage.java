package io.crunchy.core.stage;

import io.crunchy.core.model.CompressedContext;
import io.crunchy.core.pipeline.Block;
import io.crunchy.core.pipeline.PipelineStage;
import io.crunchy.core.pipeline.ProcessingContext;
import io.crunchy.core.pipeline.Weights;
import io.crunchy.core.text.TextSimilarity;
import io.crunchy.core.text.TextUtil;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Final stage: assembles the CIR document.
 *
 * <p>This is where the compression level actually bites. Extraction ran earlier
 * and only <em>recorded</em> candidates; here each one is admitted to the output
 * only if its category weight clears the level's threshold. That is what makes
 * TINY genuinely smaller than FULL rather than merely differently reported.
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
        result.setBusinessGoal(findBusinessGoal(context, result.getSummary()));
        collectLists(context);
        collectArchitecture(context);
        collectRelatedIssues(context);
        result.getIgnoredContent().addAll(context.getIgnoredContent());
        result.setConfidence(confidence(result));
        result.setCompressionRatio(compressionRatio(context));
    }

    /** Admits extracts whose category clears the level threshold, collapsing near-duplicates. */
    private void collectLists(ProcessingContext context) {
        double threshold = context.getLevel().threshold();
        Map<ProcessingContext.CirList, List<String>> targets = Map.of(
                ProcessingContext.CirList.DECISIONS, context.getResult().getDecisions(),
                ProcessingContext.CirList.CONSTRAINTS, context.getResult().getConstraints(),
                ProcessingContext.CirList.ACCEPTANCE_CRITERIA, context.getResult().getAcceptanceCriteria(),
                ProcessingContext.CirList.RISKS, context.getResult().getRisks(),
                ProcessingContext.CirList.TODOS, context.getResult().getTodos(),
                ProcessingContext.CirList.DEPENDENCIES, context.getResult().getDependencies()
        );
        for (ProcessingContext.Extract extract : context.getExtracts()) {
            if (Weights.of(extract.category()) < threshold) {
                continue;
            }
            addUnique(targets.get(extract.list()), extract.text());
        }
    }

    /**
     * Adds a value unless the list already says the same thing. When a near
     * duplicate is longer (and so more informative) it replaces the incumbent —
     * "Let's use SQS." should not survive alongside
     * "For ingestion, let's use SQS FIFO queues per carrier."
     */
    private void addUnique(List<String> target, String value) {
        for (int i = 0; i < target.size(); i++) {
            if (TextSimilarity.nearDuplicate(target.get(i), value)) {
                if (value.length() > target.get(i).length()) {
                    target.set(i, value);
                }
                return;
            }
        }
        target.add(value);
    }

    private String buildSummary(ProcessingContext context) {
        for (Block block : context.liveBlocks()) {
            if (block.getOrigin().equals("description")) {
                var sentences = TextUtil.sentences(block.getText());
                int take = Math.min(2, sentences.size());
                return String.join(" ", sentences.subList(0, take));
            }
        }
        return context.getDocument().getTitle();
    }

    /** Omitted when the summary already states it — no point paying twice. */
    private String findBusinessGoal(ProcessingContext context, String summary) {
        for (Block block : context.liveBlocks()) {
            for (String sentence : TextUtil.sentences(block.getText())) {
                if (BUSINESS_GOAL_SENTENCE.matcher(sentence).find()) {
                    return summary.contains(sentence) || TextSimilarity.nearDuplicate(summary, sentence)
                            ? "" : sentence;
                }
            }
        }
        return "";
    }

    /** Architecture notes that the decisions list does not already carry. */
    private void collectArchitecture(ProcessingContext context) {
        if (context.getLevel().threshold() > Weights.of(Block.Category.ARCHITECTURE)) {
            return;
        }
        List<String> decisions = context.getResult().getDecisions();
        for (Block block : context.liveBlocks()) {
            if (!block.getCategories().contains(Block.Category.ARCHITECTURE)
                    || block.getCategories().contains(Block.Category.DECISION)) {
                continue; // the decisions list is the canonical home
            }
            for (String sentence : TextUtil.sentences(block.getText())) {
                if (decisions.stream().anyMatch(d -> TextSimilarity.nearDuplicate(d, sentence))) {
                    continue;
                }
                addUnique(context.getResult().getArchitecture(), sentence);
            }
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
        if (!result.getBusinessGoal().isBlank() || !result.getSummary().isBlank()) confidence += 0.05;
        return Math.min(0.95, round2(confidence));
    }

    /**
     * Measured against the text the agent actually receives — every string the
     * CIR emits — not against surviving blocks. An honest number here is worth
     * more than a flattering one.
     */
    private double compressionRatio(ProcessingContext context) {
        int original = context.getDocument().rawLength();
        if (original == 0) {
            return 0.0;
        }
        CompressedContext r = context.getResult();
        int emitted = r.getIssue().length() + r.getSummary().length() + r.getBusinessGoal().length();
        for (List<String> list : List.of(r.getDecisions(), r.getConstraints(),
                r.getAcceptanceCriteria(), r.getRisks(), r.getTodos(), r.getDependencies(),
                r.getArchitecture(), r.getRelatedIssues())) {
            for (String item : list) {
                emitted += item.length();
            }
        }
        return round2(Math.max(0.0, 1.0 - (double) emitted / original));
    }

    private double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
