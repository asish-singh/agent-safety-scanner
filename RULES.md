# Detection rules

A finding requires **two independent things at once**: a hiding channel (text concealed from a human viewer) **and** agent-directed content (text written to influence an AI system). Either alone is not a finding. This intersection is the tool's core false-positive defense.

Confidence levels:

- **high** — counted in the headline prevalence number. Tier A or Tier B content in a non-accessibility hiding channel.
- **medium** — reported for human review, not counted. Any content whose hiding technique is the standard accessibility recipe, or which sits in an accessibility class context, or which appears in a "soft" channel (meta/noscript).
- **info** — reported, never treated as manipulation. Benign agent-aware content (Tier C) and legacy SEO keyword stuffing.

## Hiding channels

| ID | What it detects | Known false positives (handled) |
|----|-----------------|-------------------------------|
| H01_DISPLAY_NONE | `display:none` | collapsed menus, cookie banners — filtered by requiring agent content |
| H02_VISIBILITY_HIDDEN | `visibility:hidden` | same |
| H03_ZERO_FONT | `font-size` ≤ 1px | icon fonts rarely carry prose |
| H04_ZERO_OPACITY | `opacity:0` | animation start states — filtered by content |
| H05_OFFSCREEN | `text-indent:-9999px`, absolute/fixed position pushed offscreen | image-replacement headings, sr-only |
| H06_COLOR_MATCH | text color equal to background, or transparent | rare in legitimate copy |
| H07_HTML_COMMENT | prose inside HTML comments | conditional/tooling comments skipped |
| H08_META_PROSE | prose in meta tags (soft channel) | normal descriptions — only A/B content flagged |
| H09_ALT_TITLE_PROSE | instruction-like alt/title text | normal alt text lacks instruction phrasing |
| H10_HIDDEN_INPUT | prose in hidden form inputs | tokens/ids are not prose |
| H11_NOSCRIPT | prose in noscript (soft channel) | JS-off fallbacks — only A/B content flagged |
| H12_HIDDEN_ATTR | the `hidden` attribute | tab panels — filtered by content |
| H13_CLIP_RECT | `clip:rect(0 0 0 0)` / `clip-path:inset(100%)` | **this is the accessibility recipe** — always capped at medium |

## Content tiers (the lexicon)

Full patterns live in `src/lexicon.ts`, each with an ID and a rationale note.

- **Tier A — addresses the machine** (A1–A8): override phrasing, role assignment ("you are an AI"), direct greetings to an AI, "to any AI reading this", prompt-mechanics vocabulary, concealment instructions, output-shaping tied to summarization. A human audience for hidden versions of these is implausible, so hidden Tier A is high confidence.
- **Tier B — steers ranking/recommendation** (B1–B5): absolute recommendation, ranking demands, fabricated AI endorsement, authority-citation demands, competitor suppression. Common in *visible* marketing, so only meaningful when hidden.
- **Tier C — agent-aware, benign** (C1–C2): welcoming agent policies, machine-readable signposting. Reported as a separate positive statistic.
- **SEO_LEGACY**: hidden keyword stuffing with no instruction/agent content. Detected structurally (repetition, lack of sentence structure), reported separately. Interesting because AI systems now read text that was aimed at 2000s-era search engines.

## Stated limitations

- **Static HTML only.** Text injected by JavaScript after load is not seen. (v2: headless browser confirmation pass.)
- **Homepage + llms.txt + robots.txt only.** Inner pages are not crawled in the sweep.
- **Flat CSS only.** `<style>` rules inside media queries or nested blocks are not resolved.
- **English lexicon.** Non-English injections are not yet covered.

These limitations mean the tool **undercounts**. A reported prevalence is a floor, not a ceiling — stated plainly in any published report.

## Before publishing any finding

Every high-confidence finding is refetched and reviewed by a human. The dataset stores the URL, exact snippet, location, matched rule IDs, timestamp, and a SHA-256 of the fetched HTML so anyone can reproduce it. Published language describes what was found ("contains hidden text addressing AI systems"), never intent or accusation.
