# Dataset

This directory holds everything needed to verify or reproduce the numbers in [STUDY.md](../STUDY.md).

## What is here

- `summary.json`. Aggregate results for every sample, with the exact definitions used for each metric at the top of the file. Reachable means the homepage returned HTTP 200 with no fetch error, so a page count may differ by a few from earlier progress notes that counted redirects.
- `domain-lists/`. The exact domains scanned in each sample, one per line as `tranco_rank,domain`. All lists are drawn from the Tranco top million list dated 14 July 2026.

| Sample | Domain list | Scan mode |
|--------|-------------|-----------|
| Top 1,000 (ranks 1 to 1,000) | `top-1000.txt` | raw HTML, homepage only |
| Middle 1,000 (ranks 499,001 to 500,000) | `middle-1000.txt` | raw HTML, homepage only |
| Bottom 1,000 (ranks 999,001 to 1,000,000) | `bottom-1000.txt` | raw HTML, homepage only |
| Middle 300 rescan | `render-sample-300.txt` | rendered, up to 3 inner pages |
| User generated content 1,000 | `ugc-1000.txt` | rendered, up to 3 inner pages |
| High risk 1,000 | `shady-1000.txt` | rendered, up to 3 inner pages |

## Why per site results are not published

The scanner records which sites carry legacy hidden SEO text. Publishing that as a list would read as a public accusation aimed at named sites, which this study deliberately avoids (see the responsible handling section of STUDY.md). The dataset therefore reports aggregates only.

Full per site results are not withheld from science, they are one command away. The scanner is deterministic and makes no AI calls, so rerunning any sample regenerates the complete raw data at no cost:

```
npm install && npm run build
node dist/cli.js sweep data/domain-lists/middle-1000.txt --out results/
```

Add `--render --crawl 3` to reproduce the phase 2 scan modes. Sites change over time, so a rerun reflects the web as of the day you run it. The phase 2 raw outputs also remain attached as artifacts to the GitHub Actions runs listed in `summary.json`.
