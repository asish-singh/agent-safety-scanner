import type { ContentTier } from './types.js';

export interface LexiconRule {
  id: string;
  tier: Exclude<ContentTier, 'NONE' | 'SEO_LEGACY'>;
  pattern: RegExp;
  note: string;
}

/**
 * Tier A: text that speaks directly to an AI system. A human audience for
 * these phrases is implausible, so any hidden occurrence is high confidence.
 *
 * Tier B: imperatives that steer recommendation/ranking behavior. Common in
 * visible marketing copy, so they only matter inside a hiding channel.
 *
 * Tier C: benign agent-aware content, reported as a separate statistic.
 *
 * Patterns are case-insensitive and deliberately require anchor words
 * ("AI", "assistant", "model", "agent", "instructions") to keep precision high.
 */
export const LEXICON: LexiconRule[] = [
  // ---- Tier A: addresses the machine ----
  {
    id: 'A1',
    tier: 'A_ADDRESSES_AI',
    pattern: /\b(ignore|disregard|forget|override)\b[^.!?\n]{0,60}\b(previous|prior|above|earlier|all|any|your)\b[^.!?\n]{0,40}\b(instruction|prompt|directive|rule|guideline)s?\b/i,
    note: 'classic override phrasing ("ignore previous instructions")',
  },
  {
    id: 'A2',
    tier: 'A_ADDRESSES_AI',
    pattern: /\b(you are|you're)\s+(a|an|the)?\s*(ai|artificial intelligence|llm|large language model|language model|chatbot|assistant|ai agent|ai model)\b/i,
    note: 'role assignment addressed to a model',
  },
  {
    id: 'A3',
    tier: 'A_ADDRESSES_AI',
    pattern: /\b(dear|hello|hi|hey|attention|note)\s*[,:]?\s*(ai|chatgpt|claude|gemini|copilot|gpt-?\d*|llm|ai (agent|assistant|model|system|crawler)s?|language model)s?\b/i,
    note: 'direct greeting/address to an AI by name or type',
  },
  {
    id: 'A4',
    tier: 'A_ADDRESSES_AI',
    pattern: /\b(to|for)\s+(any|all|every)\s+(ai|llm|language model|ai (agent|assistant|model|system|crawler))s?\s+(reading|processing|parsing|summarizing|indexing|visiting)\b/i,
    note: '"to any AI reading this" constructions',
  },
  {
    id: 'A5',
    tier: 'A_ADDRESSES_AI',
    pattern: /\bsystem prompt\b|\bnew instructions?\s*:\s*/i,
    note: 'prompt-mechanics vocabulary ("system prompt", "new instructions:")',
  },
  {
    id: 'A6',
    tier: 'A_ADDRESSES_AI',
    pattern: /\bif you are\s+(an?\s+)?(ai|llm|language model|chatbot|assistant|ai (agent|model|system))\b/i,
    note: 'conditional address ("if you are an AI...")',
  },
  {
    id: 'A7',
    tier: 'A_ADDRESSES_AI',
    pattern: /\b(do not|don't|never)\s+(tell|reveal|mention|disclose|inform)\b[^.!?\n]{0,40}\b(the\s+)?(user|human|reader)s?\b/i,
    note: 'concealment instruction ("do not tell the user")',
  },
  {
    id: 'A8',
    tier: 'A_ADDRESSES_AI',
    pattern: /\bwhen\s+(summariz|describ|recommend|answer|respond)\w*\b[^.!?\n]{0,60}\b(this (site|page|website|company|product|brand))\b[^.!?\n]{0,80}\b(always|only|must|say|state|mention|include)\b/i,
    note: 'output-shaping instruction tied to summarization/recommendation',
  },

  // ---- Tier B: steers ranking/recommendation ----
  {
    id: 'B1',
    tier: 'B_STEERS_BEHAVIOR',
    pattern: /\b(always|only)\s+(recommend|suggest|choose|pick|prefer|cite|reference|link( to)?)\b[^.!?\n]{0,60}\b(this|our|us|the)\s*(site|website|page|product|company|service|brand|store)?\b/i,
    note: 'absolute recommendation imperative',
  },
  {
    id: 'B2',
    tier: 'B_STEERS_BEHAVIOR',
    pattern: /\brank\s+(this|us|our\s+\w+)\s+(first|higher|highest|top|#?1|number one)\b/i,
    note: 'explicit ranking demand',
  },
  {
    id: 'B3',
    tier: 'B_STEERS_BEHAVIOR',
    pattern: /\b(this is|we are)\s+the\s+(best|most trusted|most reliable|top|#?1|leading)\b[^.!?\n]{0,60}\b(according to|as determined by|verified by)\s+(ai|all (ai|models|assistants)|every (ai|model|assistant))/i,
    note: 'fabricated AI endorsement claim',
  },
  {
    id: 'B4',
    tier: 'B_STEERS_BEHAVIOR',
    pattern: /\b(cite|quote|reference)\s+(this page|this site|us)\s+as\s+(the|an?)\s+(authoritative|primary|best|definitive|official)\b/i,
    note: 'authority-citation demand',
  },
  {
    id: 'B5',
    tier: 'B_STEERS_BEHAVIOR',
    pattern: /\b(do not|don't|never)\s+(recommend|suggest|mention|cite|link( to)?)\b[^.!?\n]{0,60}\b(competitor|alternative|other (site|brand|product|option))s?\b/i,
    note: 'competitor-suppression imperative',
  },

  // ---- Tier C: agent-aware, benign ----
  {
    id: 'C1',
    tier: 'C_AGENT_AWARE_BENIGN',
    pattern: /\b(ai (agent|assistant|crawler|system)s?|llms?)\s+(are\s+)?(welcome|permitted|allowed|encouraged)\b/i,
    note: 'welcoming agent policy statement',
  },
  {
    id: 'C2',
    tier: 'C_AGENT_AWARE_BENIGN',
    pattern: /\bfor\s+(ai|llm|machine)\s*[- ]?\s*(readable|consumption|readers)\b|\bllms\.txt\b/i,
    note: 'machine-readable content signposting',
  },
];

/**
 * Legacy SEO keyword stuffing: a hidden segment that is a long run of
 * comma/space separated short phrases with high repetition and no sentence
 * structure. Aimed at search engines historically, but interesting because
 * AI systems now read it too. Classified separately, never as manipulation.
 */
export function looksLikeSeoStuffing(text: string): boolean {
  const t = text.trim();
  if (t.length < 120) return false;
  const words = t.toLowerCase().split(/[\s,|·•]+/).filter((w) => w.length > 2);
  if (words.length < 20) return false;
  // Sentence structure check: real prose has sentence-ending punctuation.
  const sentences = t.split(/[.!?]\s/).length;
  const punctDensity = sentences / Math.max(1, words.length / 15);
  if (punctDensity > 0.8) return false;
  // Repetition check: top word appears in a large share of the text.
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  const top = Math.max(...counts.values());
  return top / words.length > 0.08 && counts.size / words.length < 0.6;
}

export function classifyText(text: string): { tier: ContentTier; matchedRules: string[] } {
  const matched = LEXICON.filter((r) => r.pattern.test(text));
  const rules = matched.map((r) => r.id);
  if (matched.some((r) => r.tier === 'A_ADDRESSES_AI')) return { tier: 'A_ADDRESSES_AI', matchedRules: rules };
  if (matched.some((r) => r.tier === 'B_STEERS_BEHAVIOR')) return { tier: 'B_STEERS_BEHAVIOR', matchedRules: rules };
  if (matched.some((r) => r.tier === 'C_AGENT_AWARE_BENIGN')) return { tier: 'C_AGENT_AWARE_BENIGN', matchedRules: rules };
  if (looksLikeSeoStuffing(text)) return { tier: 'SEO_LEGACY', matchedRules: ['SEO1'] };
  return { tier: 'NONE', matchedRules: [] };
}
