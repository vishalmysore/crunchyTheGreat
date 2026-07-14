# CrunchyTheGreat

AI context compression engine for Jira. Reduces the text sent to coding agents
(Devin, Claude Code, Copilot, Codex, OpenHands, ...) by 70–95% while preserving
the engineering intent: decisions, acceptance criteria, constraints, risks and
open work.

Unlike LLM summarizers, the core pipeline is **deterministic** — same input,
same output, no model required. An LLM pass (WebLLM, Ollama, OpenAI, Claude)
is an optional layer on top.

## How it works

```
Jira JSON ──► Connector ──► NormalizedDocument ──► Pipeline ──► CIR (JSON/Markdown)
```

Pipeline stages (all deterministic):

1. **HTML cleaning** — JSoup strips markup, keeps line structure, drops email quotes/signatures
2. **Noise filter** — removes bot comments, greetings/acks (+1, lgtm, thanks), emoji spam, log dumps
3. **Block splitting** — paragraph-level units
4. **Duplicate detection** — word-set Jaccard collapses repeats ("Let's use Kafka" ×3 → 1)
5. **Decision extraction** — technology choices *and rejections* ("rejected RabbitMQ")
6. **Acceptance criteria** — AC/DoD sections, Given/When/Then, checkbox lists; must/should → constraints
7. **TODO extraction** — TODO/FIXME/follow-up/still-need-to
8. **Risk & dependency extraction** — security, performance, migration concerns; blockers, "blocked by X"
9. **Ranking** — every block scored (decisions 0.98 … greetings 0.01); low scores dropped per level
10. **Assembly** — summary, business goal, related issues, ignored-content report, confidence, ratio

### CIR — Context Intermediate Representation

The output is a standardized JSON contract independent of the source system,
so any agent can consume it whether the context came from Jira, GitHub Issues
or Azure DevOps:

```json
{
  "issue": "PAY-1421 Implement asynchronous payment notification service",
  "summary": "...",
  "businessGoal": "...",
  "architecture": [], "decisions": [], "constraints": [],
  "acceptanceCriteria": [], "risks": [], "todos": [],
  "dependencies": [], "relatedIssues": [], "ignoredContent": [],
  "confidence": 0.95,
  "compressionRatio": 0.70
}
```

## Modules

| Module | Purpose |
|---|---|
| `crunchy-core` | CIR model, pipeline stages, JSON/Markdown exporters, `SemanticCompressor` SPI |
| `crunchy-connector-jira` | Jira REST v2 JSON → `NormalizedDocument` (works from saved exports, no credentials needed) |
| `crunchy-cli` | `crunchy` command-line tool (shaded executable jar) |

## Build & run

Requires JDK 17+ and Maven.

```
mvn package
java -jar crunchy-cli/target/crunchy-cli-0.1.0-SNAPSHOT.jar \
    -i samples/messy-issue.json -f markdown -l tiny
```

Options:

```
-i, --input    Jira issue JSON export (GET /rest/api/2/issue/{key}?expand=comments) or plain text
-s, --source   jira | text            (default: jira)
-l, --level    tiny | small | medium | full   (default: full)
-f, --format   json | markdown       (default: json)
-o, --output   output file           (default: stdout)
```

Compression levels map to rank-score thresholds: `tiny` keeps only
decision/AC-grade content (~90% reduction target), `full` keeps everything
except detected noise.

## Try it

`samples/messy-issue.json` is a deliberately messy issue: HTML formatting,
three duplicate "use Kafka" comments, two bot messages, a 1.8 KB stack-trace
dump, greetings and emoji. The pipeline turns it into the compact context
shown above at **70% reduction (tiny)** while keeping every decision,
rejection, acceptance criterion, risk, TODO and the PLAT-77 blocker.

## Extending

- **New source**: implement a parser that returns `NormalizedDocument`
  (see `JiraIssueParser`) — the pipeline and CIR stay unchanged.
- **New stage**: implement `PipelineStage` and compose your own
  `CompressionPipeline` instead of `CompressionPipeline.standard()`.
- **LLM compression**: implement `SemanticCompressor` and post-process the
  deterministic CIR. The default is a no-op so everything works offline.

## Roadmap

- v1 (this): Jira compression, dedup, decision/AC extraction, JSON/Markdown export
- v2: Confluence, linked-issue expansion, attachment parsing, REST API, Lucene/BM25 ranking
- v3: repository & PR summarization
- v4: unified context graph + agent context-serving API
