import { createHash } from 'node:crypto';
import { extractHiddenSegments } from './hidden.js';
import { classifyText } from './lexicon.js';
import { extractInternalLinks, parseRobotsDisallows } from './crawl.js';
import { decodeCandidates, isPlausibleRot13 } from './decode.js';
import type { ContentTier, Finding, HiddenSegment, ScanResult } from './types.js';

const USER_AGENT =
  'agent-safety-scanner/0.1 (research study on hidden agent-directed text; +https://github.com/asish-singh/agent-safety-scanner)';

const FETCH_TIMEOUT_MS = 15_000;
const MAX_BODY = 3_000_000; // 3 MB cap per document

/** Build a finding from a segment plus a classification, applying the
 * soft-channel drop and confidence rules. Returns null when the finding
 * should not be reported (e.g. Tier C/SEO_LEGACY in a soft channel). */
function buildFinding(
  seg: HiddenSegment,
  tier: Exclude<ContentTier, 'NONE'>,
  matchedRules: string[],
  decoded?: Finding['decoded']
): Finding | null {
  // Meta descriptions/keywords legitimately summarize pages; only Tier A/B
  // instruction content matters there, and noscript often holds normal
  // fallback copy — same treatment.
  const softChannel = seg.channel === 'H08_META_PROSE' || seg.channel === 'H11_NOSCRIPT';
  if (softChannel && tier !== 'A_ADDRESSES_AI' && tier !== 'B_STEERS_BEHAVIOR') return null;

  // Accessibility-style hiding (sr-only recipe, clip-rect, a11y class context)
  // is legitimately ubiquitous, so we never let it reach high confidence even
  // with Tier A text. It stays a medium finding for human review, keeping the
  // headline prevalence number free of accessibility false positives.
  const softContext = seg.accessibilityPattern || softChannel;
  let confidence: Finding['confidence'];
  if (tier === 'A_ADDRESSES_AI') confidence = softContext ? 'medium' : 'high';
  else if (tier === 'B_STEERS_BEHAVIOR') confidence = softContext ? 'medium' : 'high';
  else confidence = 'info';

  return { ...seg, tier, matchedRules, confidence, ...(decoded ? { decoded } : {}) };
}

export interface SegmentScanResult {
  findings: Finding[];
  /** Hidden segments where a decode attempt produced plausible text. */
  decodedSegmentCount: number;
}

/** Classify every hidden segment, plain text first; when the plain text is
 * NONE, also try decoding it (base64/ROT13) in case the instruction is
 * hidden from the English lexicon by encoding rather than by CSS. */
export function scanSegments(segments: HiddenSegment[]): SegmentScanResult {
  const findings: Finding[] = [];
  let decodedSegmentCount = 0;

  for (const seg of segments) {
    const { tier, matchedRules } = classifyText(seg.text);
    if (tier !== 'NONE') {
      const finding = buildFinding(seg, tier, matchedRules);
      if (finding) findings.push(finding);
      continue;
    }

    let countedDecoded = false;
    for (const candidate of decodeCandidates(seg.text)) {
      // tryBase64() already gates on printable-text plausibility before
      // returning a candidate; ROT13 needs its own plausibility check since
      // it always "succeeds" but ordinary hidden prose becomes gibberish.
      const plausible = candidate.method === 'base64'
        ? true
        : isPlausibleRot13(seg.text, candidate.text);
      if (plausible && !countedDecoded) {
        decodedSegmentCount++;
        countedDecoded = true;
      }

      const decodedClass = classifyText(candidate.text);
      if (decodedClass.tier === 'NONE') continue;
      const ruleId = candidate.method === 'base64' ? 'DECODE_BASE64' : 'DECODE_ROT13';
      const finding = buildFinding(
        seg,
        decodedClass.tier,
        [ruleId, ...decodedClass.matchedRules],
        { method: candidate.method, text: candidate.text }
      );
      if (finding) findings.push(finding);
    }
  }

  return { findings, decodedSegmentCount };
}

export function segmentsToFindings(segments: HiddenSegment[]): Finding[] {
  return scanSegments(segments).findings;
}

async function fetchOnce(url: string): Promise<{ status: number; body: string; finalUrl: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,text/plain,*/*' },
      redirect: 'follow',
      signal: controller.signal,
    });
    // Read at most MAX_BODY bytes, then stop.
    const reader = res.body?.getReader();
    let body = '';
    if (reader) {
      const decoder = new TextDecoder('utf-8');
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        body += decoder.decode(value, { stream: true });
        if (body.length > MAX_BODY) { await reader.cancel(); break; }
      }
    }
    return { status: res.status, body, finalUrl: res.url || url };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch with one retry, since a single transient timeout under concurrency
 * would otherwise drop a live site and undercount the study. */
async function fetchText(url: string): Promise<{ status: number; body: string; finalUrl: string } | null> {
  const first = await fetchOnce(url);
  if (first) return first;
  await new Promise((r) => setTimeout(r, 750));
  return fetchOnce(url);
}

export interface ScanOptions {
  /** Run the page's JavaScript in a headless browser before scanning. */
  render?: boolean;
  /** Follow up to this many same-site links from the homepage and scan those too. */
  crawl?: number;
}

export interface FetchedPage {
  status: number;
  body: string;
  finalUrl: string;
  /** True only when the headless browser actually produced this page. */
  rendered: boolean;
}

type RawPage = { status: number; body: string; finalUrl: string };

/** Pure decision between a render result and its raw-HTML fallback. Kept
 * separate from fetchPage so the render/fallback outcome logic is testable
 * without any network or browser calls. */
export function resolveFetchedPage(
  renderResult: RawPage | null,
  rawResult: RawPage | null
): FetchedPage | null {
  if (renderResult) return { ...renderResult, rendered: true };
  if (rawResult) return { ...rawResult, rendered: false };
  return null;
}

/** Fetch a page either raw or through the headless browser. */
async function fetchPage(url: string, render: boolean): Promise<FetchedPage | null> {
  let renderResult: RawPage | null = null;
  if (render) {
    const { renderPage } = await import('./render.js');
    renderResult = await renderPage(url, USER_AGENT);
    // Rendering can fail on sites that block automation; fall back to raw
    // HTML so the site still counts as reachable rather than dropping it.
  }
  const rawResult = renderResult ? null : await fetchText(url);
  return resolveFetchedPage(renderResult, rawResult);
}

function scanBody(base: ScanResult, page: RawPage): ScanResult {
  const segments = extractHiddenSegments(page.body);
  const { findings, decodedSegmentCount } = scanSegments(segments);
  return {
    ...base,
    finalUrl: page.finalUrl,
    status: page.status,
    htmlSha256: createHash('sha256').update(page.body).digest('hex'),
    hiddenSegmentCount: segments.length,
    decodedSegmentCount,
    findings,
  };
}

export async function scanSite(input: string, opts: ScanOptions = {}): Promise<ScanResult> {
  const url = /^https?:\/\//i.test(input) ? input : `https://${input}`;
  const fetchedAt = new Date().toISOString();
  const base: ScanResult = {
    url: input,
    finalUrl: url,
    fetchedAt,
    status: null,
    htmlSha256: null,
    error: null,
    hiddenSegmentCount: 0,
    decodedSegmentCount: 0,
    findings: [],
    llmsTxt: { present: false, findings: [] },
    robotsTxt: { present: false, mentionsAiAgents: false },
  };

  const page = await fetchPage(url, !!opts.render);
  if (!page || page.status >= 400) {
    return { ...base, status: page?.status ?? null, error: page ? `HTTP ${page.status}` : 'fetch failed' };
  }

  const result = scanBody(base, page);
  result.rendered = page.rendered;
  if (opts.render) result.renderFallback = !page.rendered;

  const origin = new URL(page.finalUrl.startsWith('http') ? page.finalUrl : url).origin;

  // llms.txt is a PUBLIC, non-hidden file that sites publish on purpose. There
  // is no hiding channel, so by our two-part rule it can never be a manipulation
  // finding — agent-directed language there is the expected content, not a
  // signal. We record only its presence, as a benign (info) statistic.
  const llms = await fetchText(`${origin}/llms.txt`);
  if (llms && llms.status === 200 && !/<html/i.test(llms.body.slice(0, 500))) {
    result.llmsTxt.present = true;
  }

  let robotsBody = '';
  const robots = await fetchText(`${origin}/robots.txt`);
  if (robots && robots.status === 200 && !/<html/i.test(robots.body.slice(0, 500))) {
    result.robotsTxt.present = true;
    result.robotsTxt.mentionsAiAgents = /gptbot|claudebot|claude-web|anthropic|perplexitybot|google-extended|ccbot|ai2bot|bytespider|meta-external/i.test(robots.body);
    robotsBody = robots.body;
  }

  if (!opts.crawl || opts.crawl < 1) return result;

  // Shallow crawl: scan up to opts.crawl inner pages linked from the
  // homepage, respecting robots.txt. Their findings are folded into the
  // site's result (with per-page pageResults kept for evidence).
  const disallows = parseRobotsDisallows(robotsBody);
  const links = extractInternalLinks(page.body, page.finalUrl, disallows, opts.crawl);
  const pageResults: ScanResult[] = [];
  for (const link of links) {
    const inner = await fetchPage(link, !!opts.render);
    if (!inner || inner.status >= 400) continue;
    const innerBase: ScanResult = {
      ...base,
      url: link,
      finalUrl: link,
      pageOf: input,
      fetchedAt: new Date().toISOString(),
      llmsTxt: { present: false, findings: [] },
      robotsTxt: { present: false, mentionsAiAgents: false },
    };
    const innerResult = scanBody(innerBase, inner);
    innerResult.rendered = inner.rendered;
    if (opts.render) innerResult.renderFallback = !inner.rendered;
    pageResults.push(innerResult);
  }
  result.pages = pageResults;
  return result;
}
