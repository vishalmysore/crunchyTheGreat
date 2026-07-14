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
  test/             vitest ports of the 17 Java tests
  public/           messy-issue.json sample (shared by UI and tests)
```

## Develop

```
npm install
npm run dev        # Vite dev server
npm test           # vitest — 17 tests
npm run build      # tsc typecheck + Vite production build to dist/
```

## CLI

```
npx tsx src/cli.ts -i public/messy-issue.json -f markdown -l tiny
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
