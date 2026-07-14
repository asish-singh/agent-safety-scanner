/** Where hidden text was found (each is a documented rule in RULES.md). */
export type ChannelId =
  | 'H01_DISPLAY_NONE'
  | 'H02_VISIBILITY_HIDDEN'
  | 'H03_ZERO_FONT'
  | 'H04_ZERO_OPACITY'
  | 'H05_OFFSCREEN'
  | 'H06_COLOR_MATCH'
  | 'H07_HTML_COMMENT'
  | 'H08_META_PROSE'
  | 'H09_ALT_TITLE_PROSE'
  | 'H10_HIDDEN_INPUT'
  | 'H11_NOSCRIPT'
  | 'H12_HIDDEN_ATTR'
  | 'H13_CLIP_RECT';

/** What kind of content the hidden text is. */
export type ContentTier =
  | 'A_ADDRESSES_AI' // speaks directly to an AI system
  | 'B_STEERS_BEHAVIOR' // imperatives about ranking/recommending
  | 'C_AGENT_AWARE_BENIGN' // legitimate agent-directed content (llms.txt etc.)
  | 'SEO_LEGACY' // old-style hidden keyword stuffing aimed at search engines
  | 'NONE';

export interface HiddenSegment {
  channel: ChannelId;
  /** The hidden text, trimmed, capped in length. */
  text: string;
  /** CSS-selector-ish path to the node, or a location hint. */
  location: string;
  /** True when the hiding looks like a standard accessibility pattern. */
  accessibilityPattern: boolean;
}

export interface Finding {
  channel: ChannelId;
  tier: ContentTier;
  /** Which lexicon patterns matched (rule ids like A1, B3). */
  matchedRules: string[];
  text: string;
  location: string;
  accessibilityPattern: boolean;
  /**
   * Confidence after combining channel + content + whitelist:
   * 'high'   – Tier A, or Tier B in a non-accessibility hiding channel
   * 'medium' – Tier B inside an accessibility-style container
   * 'info'   – Tier C and SEO_LEGACY (reported, never counted as manipulation)
   */
  confidence: 'high' | 'medium' | 'info';
}

export interface ScanResult {
  url: string;
  /** True when the page was rendered in a headless browser before scanning. */
  rendered?: boolean;
  /** Set on crawled inner pages: the domain whose homepage led here. */
  pageOf?: string;
  finalUrl: string;
  fetchedAt: string;
  status: number | null;
  htmlSha256: string | null;
  error: string | null;
  /** Every hidden segment extracted, whether or not it matched the lexicon. */
  hiddenSegmentCount: number;
  findings: Finding[];
  llmsTxt: { present: boolean; findings: Finding[] };
  robotsTxt: { present: boolean; mentionsAiAgents: boolean };
  /** Crawl mode only: per-page results for inner pages scanned on this site. */
  pages?: ScanResult[];
}
