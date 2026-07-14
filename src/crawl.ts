/**
 * Shallow same-site crawler. The pilot read one page per site; this follows a
 * handful of internal links from the homepage so hidden text on inner pages
 * is measured too. Respects the site's robots.txt Disallow rules for
 * anonymous crawlers (User-agent: *).
 */
import * as cheerio from 'cheerio';

/** Parse the Disallow rules that apply to "User-agent: *". */
export function parseRobotsDisallows(robotsTxt: string): string[] {
  const disallows: string[] = [];
  let applies = false;
  for (const raw of robotsTxt.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const [, field, value] = m;
    if (field.toLowerCase() === 'user-agent') {
      applies = value.trim() === '*';
    } else if (applies && field.toLowerCase() === 'disallow' && value.trim()) {
      disallows.push(value.trim());
    }
  }
  return disallows;
}

export function isAllowedByRobots(path: string, disallows: string[]): boolean {
  return !disallows.some((rule) => {
    // Support the common trailing/embedded wildcard; anchor at path start.
    const pattern = '^' + rule.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*');
    return new RegExp(pattern).test(path);
  });
}

/** Skip links that are clearly not HTML pages. */
const NON_HTML_EXT = /\.(png|jpe?g|gif|svg|webp|ico|css|js|json|xml|pdf|zip|gz|mp[34]|webm|woff2?|ttf)(\?|#|$)/i;

/**
 * Pick up to `max` same-origin page links from a homepage's HTML,
 * deduplicated, robots-respecting, in document order (nav + main content
 * links come first, which is the sample we want).
 */
export function extractInternalLinks(
  html: string,
  baseUrl: string,
  disallows: string[],
  max: number
): string[] {
  const $ = cheerio.load(html);
  const base = new URL(baseUrl);
  const seen = new Set<string>([base.href, base.origin + '/']);
  const links: string[] = [];
  $('a[href]').each((_, el) => {
    if (links.length >= max) return false;
    const href = $(el).attr('href');
    if (!href) return;
    let u: URL;
    try {
      u = new URL(href, base);
    } catch {
      return;
    }
    if (u.origin !== base.origin) return;
    if (NON_HTML_EXT.test(u.pathname)) return;
    u.hash = '';
    if (seen.has(u.href)) return;
    if (!isAllowedByRobots(u.pathname + u.search, disallows)) return;
    seen.add(u.href);
    links.push(u.href);
  });
  return links;
}
