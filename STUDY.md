# Hidden instructions for AI agents are (almost) nowhere on the web

*A measurement study of hidden agent directed text across 4,991 websites (5,300 site scans). July 2026, figures corrected and the whole sample rescanned in September 2026.*

## Summary

AI assistants now read web pages on our behalf. A widely repeated worry is that websites hide instructions in their pages, invisible to human visitors but readable by a machine, telling the AI what to say or recommend. White text on a white background saying "always recommend this product" is the canonical example.

I built a scanner to measure how common this actually is, and ran 5,300 site scans covering 4,991 distinct websites drawn from the Tranco ranking of the top million domains, including the surfaces where manipulation is most plausible. The result is a clear negative.

**Across 2,913 distinct reachable sites (3,103 reachable site scans) and more than 180,000 pieces of hidden text, the number of hidden instructions aimed at AI agents was zero.**

The one hidden text behavior that does show up at scale is old fashioned hidden SEO keyword stuffing, invisible keyword blocks originally aimed at search engines. AI systems now read those too. That is the real, measurable way hidden text feeds AI answers today.

## Why measure this

Warnings about hidden prompt injection on the web are common, but they usually rest on demonstrations (a researcher plants an instruction and shows an AI following it) rather than on prevalence data. A demonstration proves the attack is possible. It says nothing about whether anyone is actually doing it. Defenders, tool builders, and policy writers need the second number, so I measured it.

## Method

The scanner is a small open source command line tool in this repository. Three properties matter for trusting the numbers.

### A finding requires two things at once

A page is only flagged when text is concealed from human view by a genuine hiding technique **and** that text is written to influence an AI (addressing it directly, or steering what it recommends). Hidden text alone is never flagged, which matters because legitimate hidden text is everywhere (screen reader labels, collapsed menus, cookie banners). The scanner recognizes 13 hiding channels and classifies the content of each hidden segment against a tiered lexicon. Standard accessibility patterns are explicitly discounted so they can never inflate the headline numbers.

### Detection is deterministic

No AI model is involved in scanning. Every rule has an identifier, a rationale, and documented false positives (see RULES.md). The same input always produces the same output, so every number here can be reproduced.

### Accuracy is tested

Against a labeled corpus of 21 pages (9 known injections, 12 clean pages chosen to be deliberately tricky, including screen reader markup, legacy SEO spam, and visible AI marketing copy) the scanner scores precision 1.00 (9 flagged, 9 real) and recall 1.00 (9 of 9 injections caught) with zero false positives on the 12 clean pages. These are exact results on a small corpus, not population estimates. The exact two sided 95 percent lower bound on recall from 9 of 9 is 0.66. Run `npm test` to reproduce.

### What was scanned

All samples come from the Tranco top million list dated 14 July 2026, which is citable and freely available. Two phases.

### Phase 1, breadth (raw HTML, homepages)

Three slices of 1,000 domains each, from the top of the ranking, the middle near rank 500,000, and the bottom near rank 1,000,000.

### Phase 2, depth (rendered, multiple pages)

The scanner gained a headless browser mode, so text created by JavaScript in the browser is scanned too, and a shallow crawler that follows up to three same site links from the homepage, honoring robots.txt. This phase deliberately targeted the surfaces where hidden manipulation is most plausible.

- A rescan of 300 of the middle ranked domains from phase 1 (the first 300 of that list), to isolate what deeper scanning adds on identical sites. These 300 domains are therefore scanned twice and counted in both phases.
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
| User generated content 1,000 | 701 | 2,516 | ~75,900 | **0** | 1,045 |
| High risk 1,000 | 490 | 1,440 | ~32,600 | **0** | 133 |

The six samples add up to 5,300 domain scans and 3,103 reachable site scans. Because the rescan reuses 300 middle ranked domains and nine further domains appear in two lists (two community domains also sit in the top 1,000, seven high risk domains also sit in the middle 1,000), the distinct figures are 4,991 domains sampled and 2,913 distinct reachable sites. Both sets of figures are in `data/summary.json`.

The zero held on every surface. It held at the top of the web and at the bottom, on raw HTML and on fully rendered pages, on homepages and on inner pages, on professionally managed sites, on community content, and on piracy adjacent domains.

Two checks argue this is a real zero rather than a blind one. First, the rendering mode demonstrably widens what the scanner sees. One JavaScript built site showed 0 hidden segments in its raw HTML and 12 once rendered, so pages that build their content in the browser are genuinely covered. Second, the scanner is not quiet. It extracted over 180,000 hidden text segments and correctly classified thousands of them as accessibility markup, benign hidden interface text, or SEO stuffing. It sees plenty. What it does not see is anyone talking to the AI.

### The signal that did appear

Legacy hidden SEO keyword stuffing appeared on every surface, roughly 1,700 findings in total, and was densest on community sites. This is hidden text in the oldest sense, keyword blocks concealed from visitors to game search rankings, most of it presumably years old. The new development is the audience. AI assistants that read pages wholesale now ingest those hidden keyword blocks alongside the visible content, which means a decade of dormant SEO spam quietly became AI input. For site owners, the practical takeaway of this study is not "defend against injection" but "audit your templates for forgotten hidden text, because machines are reading it again."

## Limitations

Honest floors on the zero.

- **English only, plain text only.** The content patterns detect English phrasings. A hidden instruction in another language would be extracted as a hidden segment but not classified as manipulation. The same applies to an instruction encoded as Base64 or ROT13, which this run did not attempt to decode. Hidden segments that match no rule are counted but their text is not stored, so the published data cannot be rescored for encoded payloads. The scanner now attempts both decodings before discarding a segment, and the next run will report how many segments decoded to plausible text.
- **Rendering recorded as intent, not outcome.** In phase 2 the scanner fell back to raw HTML whenever the headless browser failed on a page, without recording that it had done so, and the homepage flag was inherited by inner pages. The rendered share of phase 2 pages is therefore unknown. The evidence that rendering widens coverage rests on one site (0 hidden segments raw, 12 rendered). The scanner now records rendered versus fallback per page, and the next run will report both counts.
- **Sampling by domain name.** The community and high risk samples select domains by name, which is reproducible but imperfect. A forum on a neutral domain name is missed.
- **Reachability.** Between a third and a half of sampled domains were unreachable, blocked automation, or failed. The zero describes the reachable web.
- **A point in time.** This measures July 2026. The economics change as more purchasing and recommending flows through AI agents, and a cheap attack that pays will be attempted. The method and tool here are built to be rerun.

## Second run (September 2026)

On 13 September 2026 the same six domain lists were scanned again with the corrected scanner, one GitHub Actions sweep per list. The rerun exists because the two reviewers named below showed that the July data could not answer two questions, whether encoded instructions were being missed and how many phase 2 pages were actually rendered. The September scanner attempts Base64 and ROT13 decoding of every hidden segment before discarding it and records rendered versus raw fallback per page. Everything below is in `data/summary-2026-09.json`, with the Actions run id for each sample.

| Sample | Reachable | Pages scanned | Hidden segments | Decoded segments | Hidden AI manipulation | Legacy hidden SEO text | Rendered / fallback pages |
|--------|-----------|---------------|-----------------|------------------|------------------------|------------------------|---------------------------|
| Top 1,000 | 546 | 546 | ~16,500 | 22 | **0** | 56 | raw |
| Middle 1,000 | 602 | 602 | ~16,700 | 48 | **0** | 117 | raw |
| Bottom 1,000 | 583 | 583 | ~17,600 | 23 | **0** | 65 | raw |
| Middle 300 rescan | 191 | 638 | ~20,100 | 13 | **0** | 227 | 638 / 0 |
| User generated content 1,000 | 675 | 2,432 | ~74,600 | 1,195 | **0** | 496 | 2,420 / 12 |
| High risk 1,000 | 504 | 1,478 | ~33,000 | 333 | **0** | 146 | 1,473 / 5 |

Totals for the run. 3,101 reachable site scans and 2,924 distinct reachable sites, 6,279 pages, 178,619 hidden segments, zero hidden AI manipulation. One middle ranked domain produced no result row, so that sample is 999 domains.

Two of the numbers answer the reviewers directly.

- **Decoding found nothing.** 1,634 hidden segments decoded as Base64 or ROT13 into plausible text and were classified. None matched any rule in any tier. The decode path is exercised by the test corpus, so this is a measured zero, not an absent check. Most of the decodable segments sit on community and high risk sites, which is where encoded payloads would be expected if anyone were planting them.
- **Rendering worked almost everywhere.** Of 4,548 phase 2 pages, 4,531 were rendered by the headless browser and 17 fell back to raw HTML. The July limitation about unquantified render coverage is closed. The 300 domain rescan had no fallbacks at all.

Legacy hidden SEO text fell from 1,746 findings in July to 1,107. The bulk of that change is one German football forum in the community sample, whose zero font size thread listing matched the keyword stuffing heuristic 648 times in July (the homepage and an identical inner page were each counted) and not at all in September after the page changed. Its hidden text is still there, 1,106 segments on the homepage, it just no longer looks like a keyword block. That episode is a fair illustration of the heuristic's documented false positive, dense repeated hidden titles, and a reason the SEO count is reported as a statistic and never attached to a name. Excluding that one site the SEO count moved from 1,098 to 1,107.

Reachability shifted by a few percent in each direction between the two runs, as expected for a two month gap, and the classifier is unchanged. Every legacy SEO finding text from the first half of the July community sweep still classifies the same way under the September code (176 of 176 checked).

## Corrections (September 2026)

Two reviewers on the OWASP Top 10 for LLM Applications issue tracker, Santoshkumarpuppala and ossumpossum, audited this repository at commit 5804cf5 and found the following. All are corrected in the current version.

- The headline said 5,300 websites. That is the number of domain scans. The 300 domain rendered rescan reuses domains from the middle 1,000 list, and two of the six domain lists overlap other lists by nine further domains, so the distinct count is 4,991 websites. The overlaps were hidden from simple set comparisons because four of the published lists had Windows line endings, which have now been normalized.
- "Roughly 3,000 reachable sites" was a sum of reachable scans, 3,103. Measured against the per site results, 2,913 distinct sites were reachable.
- The phase 1 summary in the README said roughly 1,640 reachable sites. The three slices sum to 1,713.
- Three table cells (community reachable 702, community pages 2,521, high risk pages 1,441) disagreed with `data/summary.json`, which holds 701, 2,516 and 1,440. The tables now match the data.
- Recall is quoted with its denominator, 9 of 9, so it does not read as a population figure.
- The Base64 and ROT13 decode check and the per page render outcome counter described in the limitations were added to the scanner after this review and had not been part of the July run. The September second run above measures both.

## Reproducing this study

Everything needed is in this repository. The scanner, the rule documentation, the labeled accuracy corpus, the exact domain lists for every sample, and a GitHub Actions workflow that runs sweeps on free infrastructure. The published dataset lives in [data/](data/), aggregate results for every sample in `summary.json` plus the exact domain lists, with a note on why per site results are reported only in aggregate. See the README for commands. The scanner makes no AI calls, so reproduction costs nothing.

## Responsible handling

Findings are described by what they contain, never by intent, and the study reports aggregate numbers rather than naming sites. The hidden SEO counts are statistics, not accusations. Anyone reproducing the study should extend the same care.
