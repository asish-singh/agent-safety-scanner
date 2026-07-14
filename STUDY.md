# Hidden instructions for AI agents are (almost) nowhere on the web

*A measurement study of hidden agent directed text across 5,300 websites. July 2026.*

## Summary

AI assistants now read web pages on our behalf. A widely repeated worry is that websites hide instructions in their pages, invisible to human visitors but readable by a machine, telling the AI what to say or recommend. White text on a white background saying "always recommend this product" is the canonical example.

I built a scanner to measure how common this actually is, and ran it across 5,300 websites drawn from the Tranco ranking of the top million domains, including the surfaces where manipulation is most plausible. The result is a clear negative.

**Across roughly 3,000 reachable sites and more than 180,000 pieces of hidden text, the number of hidden instructions aimed at AI agents was zero.**

The one hidden text behavior that does show up at scale is old fashioned hidden SEO keyword stuffing, invisible keyword blocks originally aimed at search engines. AI systems now read those too. That is the real, measurable way hidden text feeds AI answers today.

## Why measure this

Warnings about hidden prompt injection on the web are common, but they usually rest on demonstrations (a researcher plants an instruction and shows an AI following it) rather than on prevalence data. A demonstration proves the attack is possible. It says nothing about whether anyone is actually doing it. Defenders, tool builders, and policy writers need the second number, so I measured it.

## Method

The scanner is a small open source command line tool in this repository. Three properties matter for trusting the numbers.

**A finding requires two things at once.** A page is only flagged when text is concealed from human view by a genuine hiding technique **and** that text is written to influence an AI (addressing it directly, or steering what it recommends). Hidden text alone is never flagged, which matters because legitimate hidden text is everywhere (screen reader labels, collapsed menus, cookie banners). The scanner recognizes 13 hiding channels and classifies the content of each hidden segment against a tiered lexicon. Standard accessibility patterns are explicitly discounted so they can never inflate the headline numbers.

**Detection is deterministic.** No AI model is involved in scanning. Every rule has an identifier, a rationale, and documented false positives (see RULES.md). The same input always produces the same output, so every number here can be reproduced.

**Accuracy is tested.** Against a labeled corpus of 21 pages (9 known injections, 12 clean pages chosen to be deliberately tricky, including screen reader markup, legacy SEO spam, and visible AI marketing copy) the scanner scores precision 1.00 and recall 1.00 with zero false positives. Run `npm test` to reproduce.

### What was scanned

All samples come from the Tranco top million list dated 14 July 2026, which is citable and freely available. Two phases.

**Phase 1, breadth (raw HTML, homepages).** Three slices of 1,000 domains each, from the top of the ranking, the middle near rank 500,000, and the bottom near rank 1,000,000.

**Phase 2, depth (rendered, multiple pages).** The scanner gained a headless browser mode, so text created by JavaScript in the browser is scanned too, and a shallow crawler that follows up to three same site links from the homepage, honoring robots.txt. This phase deliberately targeted the surfaces where hidden manipulation is most plausible.

- A rescan of 300 of the middle ranked domains from phase 1, to isolate what deeper scanning adds on identical sites.
- 1,000 domains whose names indicate forums, boards, and communities, so the crawled inner pages land on content written by users rather than site owners.
- 1,000 domains from the lower half of the ranking whose names match piracy and free streaming keywords, the least reputable corner of the list that can be sampled reproducibly.

## Results

### Phase 1, breadth

| Slice | Reachable | Hidden segments extracted | Hidden AI manipulation | Legacy hidden SEO text |
|-------|-----------|---------------------------|------------------------|------------------------|
| Top 1,000 | 525 | ~17,100 | **0** | 87 |
| Middle 1,000 (~rank 500k) | 593 | ~17,500 | **0** | 137 |
| Bottom 1,000 (~rank 1M) | 595 | ~17,600 | **0** | 66 |

### Phase 2, depth

| Sample | Reachable | Pages scanned | Hidden segments | Hidden AI manipulation | Legacy hidden SEO text |
|--------|-----------|---------------|-----------------|------------------------|------------------------|
| Middle 300 rescan | 199 | 671 | ~21,500 | **0** | 278 |
| User generated content 1,000 | 702 | 2,521 | ~75,900 | **0** | 1,045 |
| High risk 1,000 | 490 | 1,441 | ~32,600 | **0** | 133 |

The zero held on every surface. It held at the top of the web and at the bottom, on raw HTML and on fully rendered pages, on homepages and on inner pages, on professionally managed sites, on community content, and on piracy adjacent domains.

Two checks argue this is a real zero rather than a blind one. First, the rendering mode demonstrably widens what the scanner sees. One JavaScript built site showed 0 hidden segments in its raw HTML and 12 once rendered, so pages that build their content in the browser are genuinely covered. Second, the scanner is not quiet. It extracted over 180,000 hidden text segments and correctly classified thousands of them as accessibility markup, benign hidden interface text, or SEO stuffing. It sees plenty. What it does not see is anyone talking to the AI.

### The signal that did appear

Legacy hidden SEO keyword stuffing appeared on every surface, roughly 1,700 findings in total, and was densest on community sites. This is hidden text in the oldest sense, keyword blocks concealed from visitors to game search rankings, most of it presumably years old. The new development is the audience. AI assistants that read pages wholesale now ingest those hidden keyword blocks alongside the visible content, which means a decade of dormant SEO spam quietly became AI input. For site owners, the practical takeaway of this study is not "defend against injection" but "audit your templates for forgotten hidden text, because machines are reading it again."

## Limitations

Honest floors on the zero.

- **English only.** The content patterns detect English phrasings. A hidden instruction in another language would be extracted as a hidden segment but not classified as manipulation.
- **Sampling by domain name.** The community and high risk samples select domains by name, which is reproducible but imperfect. A forum on a neutral domain name is missed.
- **Reachability.** Between a third and a half of sampled domains were unreachable, blocked automation, or failed. The zero describes the reachable web.
- **A point in time.** This measures July 2026. The economics change as more purchasing and recommending flows through AI agents, and a cheap attack that pays will be attempted. The method and tool here are built to be rerun.

## Reproducing this study

Everything needed is in this repository. The scanner, the rule documentation, the labeled accuracy corpus, the exact domain lists for every sample, and a GitHub Actions workflow that runs sweeps on free infrastructure. See the README for commands. The scanner makes no AI calls, so reproduction costs nothing.

## Responsible handling

Findings are described by what they contain, never by intent, and the study reports aggregate numbers rather than naming sites. The hidden SEO counts are statistics, not accusations. Anyone reproducing the study should extend the same care.
