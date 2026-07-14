import { describe, expect, it } from 'vitest';
import { extractInternalLinks, isAllowedByRobots, parseRobotsDisallows } from '../src/crawl.js';

describe('robots.txt parsing', () => {
  it('collects Disallow rules under User-agent: *', () => {
    const rules = parseRobotsDisallows(
      'User-agent: Googlebot\nDisallow: /google-only\n\nUser-agent: *\nDisallow: /admin\nDisallow: /private/ # comment\n'
    );
    expect(rules).toEqual(['/admin', '/private/']);
  });

  it('blocks disallowed paths and allows others', () => {
    const rules = ['/admin', '/tmp/*.html'];
    expect(isAllowedByRobots('/admin/panel', rules)).toBe(false);
    expect(isAllowedByRobots('/tmp/x.html', rules)).toBe(false);
    expect(isAllowedByRobots('/blog/post', rules)).toBe(true);
  });
});

describe('internal link extraction', () => {
  const html = `
    <a href="/about">About</a>
    <a href="https://example.com/pricing">Pricing</a>
    <a href="https://other.com/away">External</a>
    <a href="/logo.png">Image</a>
    <a href="/admin/panel">Admin</a>
    <a href="/about#team">Dup after hash strip</a>
    <a href="/contact">Contact</a>`;

  it('keeps same-origin html pages, drops external, assets, robots-blocked, dups', () => {
    const links = extractInternalLinks(html, 'https://example.com/', ['/admin'], 10);
    expect(links).toEqual([
      'https://example.com/about',
      'https://example.com/pricing',
      'https://example.com/contact',
    ]);
  });

  it('respects the max cap', () => {
    expect(extractInternalLinks(html, 'https://example.com/', [], 1)).toHaveLength(1);
  });
});
