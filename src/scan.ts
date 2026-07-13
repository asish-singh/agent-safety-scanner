import { createHash } from 'node:crypto';
import { extractHiddenSegments } from './hidden.js';
import { classifyText } from './lexicon.js';
import type { Finding, HiddenSegment, ScanResult } from './types.js';

const USER_AGENT =
  'agent-safety-scanner/0.1 (research study on hidden agent-directed text; +https://github.com/asish-singh/agent-safety-scanner)';

const FETCH_TIMEOUT_MS = 15_000;
const MAX_BODY = 3_000_000; // 3 MB cap per document

export function segmentsToFindings(segments: HiddenSegment[]): Finding[] {
  const findings: Finding[] = [];
  for (const seg of segments) {
    const { tier, matchedRules } = classifyText(seg.text);
    if (tier === 'NONE') continue;
    // Meta descriptions/keywords legitimately summarize pages; only Tier A/B
    // instruction content matters there, and noscript often holds normal
    // fallback copy — same treatment.
    const softChannel = seg.channel === 'H08_META_PROSE' || seg.channel === 'H11_NOSCRIPT';
    if (softChannel && tier !== 'A_ADDRESSES_AI' && tier !== 'B_STEERS_BEHAVIOR') continue;

    // Accessibility-style hiding (sr-only recipe, clip-rect, a11y class context)
    // is legitimately ubiquitous, so we never let it reach high confidence even
    // with Tier A text. It stays a medium finding for human review, keeping the
    // headline prevalence number free of accessibility false positives.
    const softContext = seg.accessibilityPattern || softChannel;
    let confidence: Finding['confidence'];
    if (tier === 'A_ADDRESSES_AI') confidence = softContext ? 'medium' : 'high';
    else if (tier === 'B_STEERS_BEHAVIOR') confidence = softContext ? 'medium' : 'high';
    else confidence = 'info';

    findings.push({ ...seg, tier, matchedRules, confidence });
  }
  return findings;
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

export async function scanSite(input: string): Promise<ScanResult> {
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
    findings: [],
    llmsTxt: { present: false, findings: [] },
    robotsTxt: { present: false, mentionsAiAgents: false },
  };

  const page = await fetchText(url);
  if (!page || page.status >= 400) {
    return { ...base, status: page?.status ?? null, error: page ? `HTTP ${page.status}` : 'fetch failed' };
  }

  const segments = extractHiddenSegments(page.body);
  const result: ScanResult = {
    ...base,
    finalUrl: page.finalUrl,
    status: page.status,
    htmlSha256: createHash('sha256').update(page.body).digest('hex'),
    hiddenSegmentCount: segments.length,
    findings: segmentsToFindings(segments),
  };

  const origin = new URL(page.finalUrl.startsWith('http') ? page.finalUrl : url).origin;

  // llms.txt is a PUBLIC, non-hidden file that sites publish on purpose. There
  // is no hiding channel, so by our two-part rule it can never be a manipulation
  // finding — agent-directed language there is the expected content, not a
  // signal. We record only its presence, as a benign (info) statistic.
  const llms = await fetchText(`${origin}/llms.txt`);
  if (llms && llms.status === 200 && !/<html/i.test(llms.body.slice(0, 500))) {
    result.llmsTxt.present = true;
  }

  const robots = await fetchText(`${origin}/robots.txt`);
  if (robots && robots.status === 200 && !/<html/i.test(robots.body.slice(0, 500))) {
    result.robotsTxt.present = true;
    result.robotsTxt.mentionsAiAgents = /gptbot|claudebot|claude-web|anthropic|perplexitybot|google-extended|ccbot|ai2bot|bytespider|meta-external/i.test(robots.body);
  }

  return result;
}
