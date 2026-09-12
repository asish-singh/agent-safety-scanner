import { describe, it, expect } from 'vitest';
import { resolveFetchedPage } from '../src/scan.js';

const rendered = { status: 200, body: '<html>rendered</html>', finalUrl: 'https://x.example/' };
const raw = { status: 200, body: '<html>raw</html>', finalUrl: 'https://x.example/' };

describe('resolveFetchedPage (fetchPage outcome logic, no network)', () => {
  it('marks rendered:true when the headless browser actually produced the page', () => {
    const page = resolveFetchedPage(rendered, raw);
    expect(page).toEqual({ ...rendered, rendered: true });
  });

  it('falls back to raw HTML and marks rendered:false when rendering failed', () => {
    const page = resolveFetchedPage(null, raw);
    expect(page).toEqual({ ...raw, rendered: false });
  });

  it('returns null when neither rendering nor the raw fetch produced a page', () => {
    expect(resolveFetchedPage(null, null)).toBeNull();
  });
});
