# CrunchyTheGreat — TypeScript port

Browser + Node port of the deterministic Jira context-compression engine. Same
10-stage pipeline, same CIR schema, same test fixture as the Java reference at
the repo root — but with **zero runtime dependencies**, so it runs entirely in
a browser tab and deploys to GitHub Pages.

Live demo: https://vishalmysore.github.io/crunchyTheGreat/

## Why TypeScript

- **Runs in the browser** — paste a Jira export, get compressed context; no
  server, no upload, no LLM. Nothing leaves the page.
- **Atlassian Forge** apps are JavaScript runtimes, so this same core can run
  inside a Jira app, a CLI, and the web UI from one codebase.
- **WebLLM-ready** — the optional `SemanticCompressor` seam can wrap an
  in-browser model later without touching the deterministic core.

## Layout

```
web/
  src/core/         CIR model, 10 pipeline stages, exporters, SemanticCompressor
  src/connector/    Jira REST v2 JSON -> NormalizedDocument
  src/cli.ts        Node CLI (no deps)
  src/main.ts       browser UI entry
  test/             vitest suite (41 tests, incl. per-sample smoke tests)
  public/           demo tickets across domains (healthcare, insurance,
                    logistics), shared by the UI and tests
```

## Validating the crunch with a local LLM

The app ships an optional A/B panel: it asks one local model (WebLLM on WebGPU)
the **same question** over the **raw ticket** and the **compressed brief**, then
shows both answers side by side with prompt tokens and latency. If the answers
agree, the compression kept what mattered; if they don't, it dropped something
it shouldn't have — which is the point.

Measured locally on the healthcare sample at `tiny` (Qwen2.5 0.5B):
**690 → 305 prompt tokens (56% fewer) and 9.6 s faster**, with both arms still
naming the FHIR decision.

Notes:
- **It is entirely optional.** WebLLM is lazy-loaded into a worker, so the
  compressor page stays ~24 kB; nothing is fetched until you open the panel.
- **Pick 1B or larger.** The 0.5B model answers thinly — it often misses a
  rejected option *even when reading the raw ticket*, which makes it a poor
  judge of what compression lost.
- WebGPU + cross-origin isolation are required. Locally Vite sets the COOP/COEP
  headers; on GitHub Pages `public/coi-serviceworker.js` does it, since Pages
  cannot send headers itself.
- The worker, bridge and lazy-tokenizer patterns are adapted from the sibling
  `ragCompressionDemo/headroom-demo` project.

## Develop

```
npm install
npm run dev        # Vite dev server
npm test           # vitest — 17 tests
npm run build      # tsc typecheck + Vite production build to dist/
```

## CLI

```
npx tsx src/cli.ts -i public/healthcare-issue.json -f markdown -l tiny
```

Options mirror the Java CLI: `-i/--input`, `-s/--source` (jira|text),
`-l/--level` (tiny|small|medium|full), `-f/--format` (json|markdown),
`-o/--output`.

## Use as a library

```ts
import { parseJiraIssue } from './connector/jira/JiraIssueParser.js';
import { CompressionPipeline, CompressionLevel, toJson } from './core/index.js';

const doc = parseJiraIssue(jiraJsonString);
const cir = CompressionPipeline.standard().process(doc, CompressionLevel.FULL);
console.log(toJson(cir));
```

## Deployment

Pushes to `main` that touch `web/**` trigger
[`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml),
which runs the tests, builds, and publishes `web/dist` to GitHub Pages. The
Vite `base` is `/crunchyTheGreat/` to match the project-site URL path.

> Requires the repository's **Settings → Pages → Source** to be set to
> **GitHub Actions**.
