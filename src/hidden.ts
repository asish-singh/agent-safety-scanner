import * as cheerio from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import type { ChannelId, HiddenSegment } from './types.js';

const MAX_TEXT = 600;
const MIN_TEXT = 12; // ignore tiny fragments ("x", "close") — they can't carry instructions

const A11Y_CLASS = /\b(sr-only|sr_only|visually-?hidden|visuallyhidden|screen-?reader|skip-?link|a11y|assistive|u-hidden-visually|elementor-screen-only)\b/i;

interface HideReason {
  channel: ChannelId;
  a11yStyle: boolean; // hiding technique itself is the standard accessibility recipe
}

function parseDeclarations(style: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const decl of style.split(';')) {
    const i = decl.indexOf(':');
    if (i === -1) continue;
    map.set(decl.slice(0, i).trim().toLowerCase(), decl.slice(i + 1).trim().toLowerCase().replace(/\s*!important\s*$/, ''));
  }
  return map;
}

function numeric(v: string | undefined): number | null {
  if (!v) return null;
  const m = v.match(/^(-?\d+(?:\.\d+)?)(px|pt|em|rem|%)?$/);
  return m ? parseFloat(m[1]) : null;
}

/** Normalize a CSS color to a comparable token, or null if unparseable. */
function normColor(v: string | undefined): string | null {
  if (!v) return null;
  const s = v.trim().toLowerCase();
  const named: Record<string, string> = { white: '#ffffff', black: '#000000', transparent: 'transparent' };
  if (named[s]) return named[s];
  const hex3 = s.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  if (hex3) return `#${hex3[1]}${hex3[1]}${hex3[2]}${hex3[2]}${hex3[3]}${hex3[3]}`;
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  const rgb = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) return `#${[rgb[1], rgb[2], rgb[3]].map((n) => (+n).toString(16).padStart(2, '0')).join('')}`;
  return null;
}

/** Decide whether a declaration map hides content, and via which channel. */
function hidingChannel(decls: Map<string, string>): HideReason | null {
  if (decls.get('display') === 'none') return { channel: 'H01_DISPLAY_NONE', a11yStyle: false };
  if (decls.get('visibility') === 'hidden') return { channel: 'H02_VISIBILITY_HIDDEN', a11yStyle: false };
  const fs = numeric(decls.get('font-size'));
  if (fs !== null && fs <= 1) return { channel: 'H03_ZERO_FONT', a11yStyle: false };
  const op = numeric(decls.get('opacity'));
  if (op !== null && op === 0) return { channel: 'H04_ZERO_OPACITY', a11yStyle: false };
  const ti = numeric(decls.get('text-indent'));
  if (ti !== null && ti <= -999) return { channel: 'H05_OFFSCREEN', a11yStyle: false };
  const pos = decls.get('position');
  if (pos === 'absolute' || pos === 'fixed') {
    const left = numeric(decls.get('left'));
    const top = numeric(decls.get('top'));
    if ((left !== null && left <= -999) || (top !== null && top <= -999)) {
      return { channel: 'H05_OFFSCREEN', a11yStyle: false };
    }
    // classic visually-hidden recipe: absolute + 1px box + clip
    const w = numeric(decls.get('width'));
    const h = numeric(decls.get('height'));
    const clip = decls.get('clip') ?? decls.get('clip-path');
    if (clip && /rect\(\s*0|inset\(\s*(100%|50%)/.test(clip) && (w === null || w <= 1) && (h === null || h <= 1)) {
      return { channel: 'H13_CLIP_RECT', a11yStyle: true };
    }
    if (clip && /rect\(\s*(0|1px)[ ,]/.test(clip)) return { channel: 'H13_CLIP_RECT', a11yStyle: true };
  }
  const clip = decls.get('clip') ?? decls.get('clip-path');
  if (clip && /rect\(\s*0(px)?\s*[, ]\s*0(px)?\s*[, ]\s*0(px)?\s*[, ]\s*0(px)?\s*\)|inset\(\s*100%/.test(clip)) {
    return { channel: 'H13_CLIP_RECT', a11yStyle: true };
  }
  const color = normColor(decls.get('color'));
  const bg = normColor(decls.get('background-color') ?? decls.get('background'));
  if (color && (color === 'transparent' || (bg && bg !== 'transparent' && color === bg))) {
    return { channel: 'H06_COLOR_MATCH', a11yStyle: false };
  }
  return null;
}

function nodePath(el: Element, $: cheerio.CheerioAPI): string {
  const parts: string[] = [];
  let cur: Element | null = el;
  for (let depth = 0; cur && depth < 4; depth++) {
    const id = cur.attribs?.id ? `#${cur.attribs.id}` : '';
    const cls = cur.attribs?.class ? '.' + cur.attribs.class.trim().split(/\s+/).slice(0, 2).join('.') : '';
    parts.unshift(`${cur.tagName}${id}${cls}`);
    cur = (cur.parent && (cur.parent as Element).tagName ? (cur.parent as Element) : null);
  }
  return parts.join(' > ');
}

function cleanText(t: string): string {
  return t.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
}

/** Extract simple selector→declarations pairs from <style> blocks. Handles
 * flat rules only (no media queries/nesting); this limitation is in RULES.md. */
function styleRules(css: string): Array<{ selector: string; decls: Map<string, string> }> {
  const out: Array<{ selector: string; decls: Map<string, string> }> = [];
  const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const ruleRe = /([^{}@]+)\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = ruleRe.exec(noComments))) {
    const decls = parseDeclarations(m[2]);
    if (hidingChannel(decls)) {
      for (const sel of m[1].split(',')) {
        const s = sel.trim();
        // keep only simple, safely queryable selectors
        if (/^[a-z0-9 .#_>*[\]="'-]+$/i.test(s) && !s.includes(':')) out.push({ selector: s, decls });
      }
    }
  }
  return out;
}

/**
 * Extract every text segment hidden from human view. This is deliberately
 * over-inclusive at this stage — classification decides what matters.
 */
export function extractHiddenSegments(html: string): HiddenSegment[] {
  const $ = cheerio.load(html);
  const segments: HiddenSegment[] = [];
  const seen = new Set<string>();

  const push = (channel: ChannelId, text: string, location: string, a11y: boolean) => {
    const t = cleanText(text);
    if (t.length < MIN_TEXT) return;
    const key = `${channel}|${t}`;
    if (seen.has(key)) return;
    seen.add(key);
    segments.push({ channel, text: t, location, accessibilityPattern: a11y });
  };

  const isA11yContext = (el: Element): boolean =>
    A11Y_CLASS.test($(el).attr('class') ?? '') ||
    $(el).parents().toArray().some((p) => A11Y_CLASS.test($(p as Element).attr('class') ?? ''));

  // 1. Inline-style hiding
  $('[style]').each((_, el) => {
    const reason = hidingChannel(parseDeclarations($(el).attr('style') ?? ''));
    if (!reason) return;
    const text = $(el).text();
    push(reason.channel, text, nodePath(el as Element, $), reason.a11yStyle || isA11yContext(el as Element));
  });

  // 2. <style>-block hiding applied to matching elements
  const rules = $('style').toArray().flatMap((s) => styleRules($(s).text()));
  for (const { selector, decls } of rules) {
    const reason = hidingChannel(decls)!;
    let matches: cheerio.Cheerio<AnyNode>;
    try { matches = $(selector); } catch { continue; }
    matches.each((_, el) => {
      push(reason.channel, $(el).text(), `${selector} :: ${nodePath(el as Element, $)}`, reason.a11yStyle || isA11yContext(el as Element));
    });
  }

  // 3. hidden attribute
  $('[hidden]').each((_, el) => {
    push('H12_HIDDEN_ATTR', $(el).text(), nodePath(el as Element, $), isA11yContext(el as Element));
  });

  // 4. HTML comments containing prose
  const walk = (nodes: AnyNode[]) => {
    for (const n of nodes) {
      if (n.type === 'comment') {
        const data = (n as { data?: string }).data ?? '';
        // skip conditional comments / tooling markers
        if (!/^\s*\[if|^\s*(end|begin|\/?noindex|__|\s*-->)/i.test(data)) {
          push('H07_HTML_COMMENT', data, 'html comment', false);
        }
      }
      const kids = (n as { children?: AnyNode[] }).children;
      if (kids) walk(kids);
    }
  };
  walk($.root().toArray()[0].children as AnyNode[]);

  // 5. Meta tags carrying prose (description/keywords are normal; only capture
  //    for classification — the classifier ignores non-instruction prose)
  $('meta[name][content]').each((_, el) => {
    const content = $(el).attr('content') ?? '';
    if (content.length >= MIN_TEXT) {
      push('H08_META_PROSE', content, `meta[name="${$(el).attr('name')}"]`, false);
    }
  });

  // 6. alt/title attributes with sentence-like content
  $('[alt], [title]').each((_, el) => {
    for (const attr of ['alt', 'title'] as const) {
      const v = $(el).attr(attr);
      if (v && v.length >= 40 && /[.!?]/.test(v)) {
        push('H09_ALT_TITLE_PROSE', v, `${nodePath(el as Element, $)}[${attr}]`, false);
      }
    }
  });

  // 7. hidden form inputs with prose values
  $('input[type="hidden"][value]').each((_, el) => {
    const v = $(el).attr('value') ?? '';
    if (v.length >= 40 && /\s\w+\s\w+\s/.test(v)) {
      push('H10_HIDDEN_INPUT', v, nodePath(el as Element, $), false);
    }
  });

  // 8. noscript blocks (visible only when JS is off — effectively hidden)
  $('noscript').each((_, el) => {
    push('H11_NOSCRIPT', $(el).text(), nodePath(el as Element, $), false);
  });

  return segments;
}
