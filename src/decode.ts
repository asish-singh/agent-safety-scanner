/**
 * Decoding helpers for hidden segments whose plain text doesn't match the
 * English lexicon but might be carrying an encoded instruction (base64 or
 * ROT13). Deterministic, no AI calls — same design rule as the rest of the
 * scan path.
 */

const BASE64_CHARSET = /^[A-Za-z0-9+/_-]+=*$/;

/** Small stoplist for judging whether a decoded string reads like English. */
const STOPWORDS = new Set([
  'the', 'and', 'you', 'to', 'of', 'is', 'this', 'for', 'are', 'with',
  'agent', 'assistant', 'ignore', 'instructions',
]);

/** Share of words that are common English stopwords (0 when there are none). */
export function commonWordShare(text: string): number {
  const words = text.toLowerCase().match(/[a-z']+/g) ?? [];
  if (words.length === 0) return 0;
  let hits = 0;
  for (const w of words) if (STOPWORDS.has(w)) hits++;
  return hits / words.length;
}

/** A ROT13 decode only counts as a plausible instruction if it reads more
 * like English than the original text did — ordinary hidden prose run
 * through ROT13 becomes gibberish and must not count. */
export function isPlausibleRot13(original: string, decoded: string): boolean {
  return commonWordShare(decoded) > commonWordShare(original);
}

export function rot13(text: string): string {
  return text.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= 'Z' ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

/**
 * Attempt a base64 decode of `text`. Returns the decoded string only when the
 * input plausibly IS base64 (charset, length, padding) and the decoded bytes
 * are mostly printable text (>=90%, no NUL bytes) — otherwise null. This is
 * the plausibility gate for base64: a random alphanumeric token that happens
 * to match the base64 alphabet but decodes to non-printable bytes is rejected
 * here.
 */
export function tryBase64(text: string): string | null {
  const stripped = text.replace(/\s+/g, '');
  if (stripped.length < 16) return null;
  if (!BASE64_CHARSET.test(stripped)) return null;
  if (stripped.replace(/=+$/, '').length % 4 === 1) return null; // impossible base64 length

  let normalized = stripped.replace(/-/g, '+').replace(/_/g, '/');
  const padNeeded = (4 - (normalized.length % 4)) % 4;
  normalized += '='.repeat(padNeeded);
  if (normalized.length % 4 !== 0) return null;

  let buf: Buffer;
  try {
    buf = Buffer.from(normalized, 'base64');
  } catch {
    return null;
  }
  if (buf.length === 0) return null;
  if (buf.includes(0)) return null; // NUL byte disqualifies

  let decoded: string;
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return null; // not valid UTF-8
  }
  const chars = Array.from(decoded);
  if (chars.length === 0) return null;
  let printable = 0;
  for (const ch of chars) {
    const code = ch.codePointAt(0) ?? 0;
    const isControlWhitespace = code === 0x09 || code === 0x0a || code === 0x0d;
    const isAsciiPrintable = code >= 0x20 && code < 0x7f;
    const isNonAsciiText = code > 0x7f;
    if (isControlWhitespace || isAsciiPrintable || isNonAsciiText) printable++;
  }
  if (printable / chars.length < 0.9) return null;
  return decoded;
}

export interface DecodeCandidate {
  method: 'base64' | 'rot13';
  text: string;
}

/** All decode candidates worth classifying for a hidden segment's text. */
export function decodeCandidates(text: string): DecodeCandidate[] {
  const candidates: DecodeCandidate[] = [];
  const b64 = tryBase64(text);
  if (b64 !== null) candidates.push({ method: 'base64', text: b64 });
  candidates.push({ method: 'rot13', text: rot13(text) });
  return candidates;
}
