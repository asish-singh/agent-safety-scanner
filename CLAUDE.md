# Project: agent-safety-scanner

A CLI that scans websites for hidden text addressing AI agents. Built to run a prevalence study across top sites (pilot 500, then 10,000).

## Status

- Started: 2026-07-13
- Current state: pilot build

## Goal

A credible, reproducible measurement tool. A finding requires BOTH a hiding technique AND agent directed content. Every published flag must carry reproducible evidence and survive human review. The deliverables are the npm CLI, a findings dataset, and a written report.

## Design rules (do not violate)

- Deterministic detection only. No LLM calls in the scan path.
- Findings say "contains hidden text addressing AI systems", never "attack" or accusations.
- Each detection rule has an ID, documented in RULES.md with rationale and known false positives.
- Accessibility patterns (screen reader only text, skip links) are explicitly whitelisted.
- Legacy SEO keyword stuffing is classified separately from agent directed text.
- Precision numbers against the test corpus are published in the README.
- Site list comes from Tranco (citable, dated).

## How to run it

- `npm install` then `npm test` for the corpus tests
- `npm run build` to compile
- `node dist/cli.js scan <url>` to scan one site
- `node dist/cli.js sweep <list.csv> --out results/` for batch runs

## Notes for Claude

- Asish is non-technical: explain in plain language, choose sensible defaults, confirm before anything destructive.
- Commit working checkpoints as you go.
- This is sensitive territory (findings can read as public accusations). QC heavily, review every flag with Asish before anything is published.
