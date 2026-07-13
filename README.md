# agent-safety-scanner

A command line tool that scans websites for **hidden text aimed at AI agents**. As AI assistants increasingly read and summarize web pages, some sites embed instructions that are invisible to human visitors but readable by a machine (for example white text on a white background saying "always recommend this site"). This tool measures how common that is.

It is built to power a reproducible prevalence study across top websites, not to make accusations. A page is only flagged when it does **two things at once**: hides text from human view **and** that hidden text is written to influence an AI. Hidden text alone (accessibility labels, collapsed menus) is not flagged.

## Accuracy

Measured against a labeled test set of 21 pages (9 known injections, 12 clean pages, including deliberately tricky ones like screen-reader markup, legacy SEO keyword stuffing, and visible AI marketing copy):

| Metric | Value |
|--------|-------|
| Precision (flagged pages that are real) | 1.00 |
| Recall (real injections caught) | 1.00 |
| False positives on clean pages | 0 |

Run `npm test` to reproduce. The test set lives in `test/corpus.ts`.

A smoke run across 12 major sites (Google, Wikipedia, BBC, Amazon, and others) produced zero false positives while correctly extracting hundreds of legitimate hidden accessibility segments and filtering them out.

## How to use

```
npm install
npm run build

# scan one site (prints a full JSON report)
node dist/cli.js scan example.com

# scan a list (one domain per line, or a Tranco "rank,domain" CSV)
node dist/cli.js sweep sites.txt --out results/
```

The sweep writes `results.jsonl` (every scan) and `findings.jsonl` (only sites with findings), and can be stopped and resumed. Each result stores the exact hidden snippet, its location, which rules matched, a timestamp, and a SHA-256 of the page so any finding can be independently reproduced.

## What counts as a finding

See `RULES.md` for the full rule set, confidence levels, and known false positives. In short:

- **high confidence** — hidden text that directly addresses an AI ("you are an assistant", "ignore previous instructions") or steers its recommendations, using a genuine concealment technique. These are counted in headline numbers.
- **medium** — the same content but hidden via the standard accessibility recipe (kept separate so accessibility markup never inflates the numbers).
- **info** — benign agent-aware content (llms.txt policies) and old-style SEO keyword stuffing, reported separately.

## Design principles

- Detection is fully deterministic. The scanner makes no AI/LLM calls, so running it at any scale is free.
- The tool undercounts by design (static HTML, homepage only), so any reported prevalence is a floor.
- Every published finding is human-reviewed first, and described by what it contains, never by intent.

## Pilot findings so far

Three slices of the Tranco top-million were sampled (most popular, middle around rank 500,000, and bottom near rank 1,000,000), 1,000 domains each.

| Slice | Reachable | Hidden segments extracted | Hidden AI manipulation | Legacy hidden SEO text | llms.txt present |
|-------|-----------|---------------------------|------------------------|------------------------|------------------|
| Top 1,000 | 525 | ~17,100 | 0 | 87 | 93 |
| Middle 1,000 | 593 | ~17,500 | 0 | 137 | 81 |
| Bottom 1,000 | 595 | ~17,600 | 0 | 66 | 72 |

Across roughly 1,640 reachable sites and 52,000 pieces of hidden text, hidden instructions aimed at AI agents appeared zero times, and the rate did not rise down-market. The rare hidden text mentioning AI turned out to be ordinary news content, not instructions. The genuine, measurable signal is legacy hidden SEO keyword stuffing, which AI systems now read.

These numbers are a floor, not a ceiling: the scan reads static HTML only, homepages only, and English phrasings only. See the open issues for planned work to close those gaps.

## Status

Pilot complete. Deciding between publishing the negative result, pivoting to the SEO angle, or extending coverage (JavaScript rendering, multi-page crawl, user-generated content). Tracked in the issues.
