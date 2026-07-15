# CrunchyTheGreat

AI context compression engine for Jira. Reduces the text sent to coding agents
(Devin, Claude Code, Copilot, Codex, OpenHands, ...) by 70–95% while preserving
the engineering intent: decisions, acceptance criteria, constraints, risks and
open work.

Unlike LLM summarizers, the core pipeline is **deterministic** — same input,
same output, no model required. An LLM pass (WebLLM, Ollama, OpenAI, Claude)
is an optional layer on top.

> **Two implementations in this repo:**
> - **Java** (root, `crunchy-*` modules) — the reference implementation, JDK 17+/Maven.
> - **TypeScript** ([`web/`](web/)) — a zero-dependency browser + Node port with the
>   same pipeline, CIR schema and tests. **Live demo:**
>   https://vishalmysore.github.io/crunchyTheGreat/

## How it works

```
Jira JSON ──► Connector ──► NormalizedDocument ──► Pipeline ──► CIR (JSON/Markdown)
```

Pipeline stages (all deterministic):

1. **HTML cleaning** — JSoup strips markup, keeps line structure, drops email quotes/signatures
2. **Noise filter** — removes bot comments, greetings/acks (+1, lgtm, thanks), emoji spam, log dumps
3. **Block splitting** — paragraph-level units
4. **Duplicate detection** — word-set Jaccard collapses repeats ("Let's use FHIR R4" ×3 → 1)
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
  "issue": "CARE-2087 Sync telehealth appointments to the EHR via FHIR",
  "summary": "...",
  "businessGoal": "...",
  "architecture": [], "decisions": [], "constraints": [],
  "acceptanceCriteria": [], "risks": [], "todos": [],
  "dependencies": [], "relatedIssues": [], "ignoredContent": [],
  "confidence": 0.95,
  "compressionRatio": 0.65
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
    -i samples/healthcare-issue.json -f markdown -l tiny
```

Options:

```
-i, --input    Jira issue JSON export (GET /rest/api/2/issue/{key}?expand=comments) or plain text
-s, --source   jira | text            (default: jira)
-l, --level    tiny | small | medium | full   (default: full)
-f, --format   json | markdown       (default: json)
-o, --output   output file           (default: stdout)
```

Compression levels gate whole CIR sections by category weight, so each level
emits strictly less than the one below it:

| Level | Threshold | Sections emitted |
| --- | --- | --- |
| `tiny` | 0.90 | decisions + acceptance criteria (the irreducible brief) |
| `small` | 0.86 | + constraints |
| `medium` | 0.84 | + risks |
| `full` | 0.00 | + dependencies, todos — everything except detected noise |

`compressionRatio` is measured against the text the agent actually receives
(every string the CIR emits), not against surviving internal blocks. The web
app reports the reduction of the rendered Markdown brief against the raw
ticket text — a few points lower, since Markdown adds its own syntax.

## Try it

[**Live demo →**](https://vishalmysore.github.io/crunchyTheGreat/)

`samples/` ships deliberately messy issues across three software domains:

| Sample | Domain | Ticket |
| --- | --- | --- |
| `healthcare-issue.json` | Healthcare | telehealth → EHR sync via FHIR (HIPAA/PHI) |
| `insurance-issue.json` | Insurance | claims adjudication rules engine |
| `logistics-issue.json` | Logistics | shipment tracking from carrier webhooks |

Each has HTML formatting, duplicated decisions, bot messages, a stack-trace
dump and greetings. The healthcare ticket's Markdown brief is **33% smaller at
full fidelity and 60% smaller at tiny** (642 → 258 tokens), keeping every
decision, rejection and acceptance criterion. Tickets with the big log dumps
and long duplicate threads common in real Jira compress considerably harder.

Both implementations are byte-identical: the Java CLI and the TypeScript CLI
emit the same Markdown for every sample at every level.

## Try it on a real public Jira

Several open-source projects run Jira with **anonymous REST access**, so you can
compress a real ticket without credentials:

| Instance | Example |
| --- | --- |
| Apache (Kafka, Spark, Lucene…) | `https://issues.apache.org/jira/rest/api/2/issue/LUCENE-9004` |
| Jenkins | `https://issues.jenkins.io/rest/api/2/issue/JENKINS-70000` |
| MongoDB | `https://jira.mongodb.org/rest/api/2/issue/SERVER-70000` |

```bash
curl -s "https://issues.apache.org/jira/rest/api/2/issue/LUCENE-9004" -o ticket.json
npx tsx src/cli.ts -i ticket.json -f markdown -l full   # from web/
```

Then paste that JSON into the [web app](https://vishalmysore.github.io/crunchyTheGreat/).
The app cannot fetch these URLs for you: none of these hosts send
`Access-Control-Allow-Origin`, so a browser blocks the request. Fetch it
yourself and paste.

**Real tickets are where the compression earns its keep** — they carry the long
duplicate threads and log dumps the bundled samples lack:

| Ticket | Comments | Raw text | Reduction (full) |
| --- | --- | --- | --- |
| `SPARK-40588` | 8 | 5.7 KB | **91%** |
| `KAFKA-9366` | 33 | 11.5 KB | **87%** |
| `LUCENE-9004` | 68 | 64.6 KB | **88%** |

**Known gap, honestly:** the *ratio* holds on real tickets, but *extraction
quality* does not transfer as well. Apache tickets rarely contain an
"Acceptance Criteria" heading or a "let's use X" decision sentence, so on the
three above the extractor finds 0–1 decisions and no acceptance criteria, while
`constraints` fills up with any sentence containing "should". The heuristics are
tuned to tickets written like the bundled samples. Broadening them for
real-world phrasing is the most valuable next contribution.

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
