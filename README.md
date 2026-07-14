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

# deeper modes (work on both commands)
node dist/cli.js scan example.com --render      # run the page's JavaScript first (headless browser)
node dist/cli.js scan example.com --crawl 3     # also scan up to 3 same-site pages linked from the homepage
node dist/cli.js sweep sites.txt --out results/ --render --crawl 3
```

`--render` uses Playwright (installed with `npx playwright install chromium`) so text created by JavaScript in the browser is scanned too. It falls back to raw HTML when a site blocks automation. `--crawl` respects each site's robots.txt rules and folds inner page findings into the site's result.

The sweep writes `results.jsonl` (every scan) and `findings.jsonl` (only sites with findings), and can be stopped and resumed. Each result stores the exact hidden snippet, its location, which rules matched, a timestamp, and a SHA-256 of the page so any finding can be independently reproduced.

## What counts as a finding

See `RULES.md` for the full rule set, confidence levels, and known false positives. In short:

- **high confidence** — hidden text that directly addresses an AI ("you are an assistant", "ignore previous instructions") or steers its recommendations, using a genuine concealment technique. These are counted in headline numbers.
- **medium** — the same content but hidden via the standard accessibility recipe (kept separate so accessibility markup never inflates the numbers).
- **info** — benign agent-aware content (llms.txt policies) and old-style SEO keyword stuffing, reported separately.

## Design principles

- Detection is fully deterministic. The scanner makes no AI/LLM calls, so running it at any scale is free.
- The default scan undercounts by design (static HTML, homepage only), so any reported prevalence is a floor. The `--render` and `--crawl` modes close the JavaScript and inner page gaps for targeted samples.
- Every published finding is human-reviewed first, and described by what it contains, never by intent.

## Pilot findings so far

Three slices of the Tranco top-million were sampled (most popular, middle around rank 500,000, and bottom near rank 1,000,000), 1,000 domains each.

| Slice | Reachable | Hidden segments extracted | Hidden AI manipulation | Legacy hidden SEO text | llms.txt present |
|-------|-----------|---------------------------|------------------------|------------------------|------------------|
| Top 1,000 | 525 | ~17,100 | 0 | 87 | 93 |
| Middle 1,000 | 593 | ~17,500 | 0 | 137 | 81 |
| Bottom 1,000 | 595 | ~17,600 | 0 | 66 | 72 |

Across roughly 1,640 reachable sites and 52,000 pieces of hidden text, hidden instructions aimed at AI agents appeared zero times, and the rate did not rise down-market. The rare hidden text mentioning AI turned out to be ordinary news content, not instructions. The genuine, measurable signal is legacy hidden SEO keyword stuffing, which AI systems now read.

### Extended coverage (rendered, multi-page)

The pilot's blind spots were then closed and the same question asked again, this time with JavaScript rendered in a headless browser and up to 3 inner pages scanned per site, on samples chosen to maximize the chance of finding manipulation:

| Sample | Reachable | Pages scanned | Hidden segments | Hidden AI manipulation | Legacy hidden SEO |
|--------|-----------|---------------|-----------------|------------------------|-------------------|
| Middle 300 (rescan of pilot domains) | 199 | 671 | ~21,500 | 0 | 278 |
| User generated content 1,000 (forums, boards, communities) | 702 | 2,521 | ~75,900 | 0 | 1,045 |
| High risk 1,000 (piracy and free streaming style names, lower half) | 490 | 1,441 | ~32,600 | 0 | 133 |

The zero held everywhere. Cumulatively, roughly 3,000 reachable sites and over 180,000 pieces of hidden text have been examined without one hidden instruction aimed at an AI agent. Rendering demonstrably widens what the scanner sees (one JavaScript built site went from 0 hidden segments raw to 12 rendered), so the zero is not an artifact of shallow reading. The remaining known limit is English only content patterns.

## The study

The full written study, method, results, and limitations, lives in [STUDY.md](STUDY.md).

## Status

Measurement complete across raw and rendered scans, homepages and inner pages, popular, mid ranked, community, and high risk sites. Next step is the written study and the published dataset. Tracked in the issues.
