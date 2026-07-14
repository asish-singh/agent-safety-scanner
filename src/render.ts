/**
 * Optional headless-browser fetch. The pilot read only the raw HTML a server
 * sends; this module runs the page's JavaScript in an invisible Chromium and
 * returns the DOM as it exists after rendering, so text created in the
 * browser is scannable too. Deterministic: no AI calls, just a browser.
 */
import type { Browser } from 'playwright';

const RENDER_TIMEOUT_MS = 25_000;
/** Small settle window after load so late scripts can inject content. */
const SETTLE_MS = 1_500;

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = import('playwright').then((pw) =>
      pw.chromium.launch({ headless: true })
    );
  }
  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    browserPromise = null;
    await b?.close().catch(() => {});
  }
}

export interface RenderedPage {
  status: number;
  body: string;
  finalUrl: string;
}

export async function renderPage(url: string, userAgent: string): Promise<RenderedPage | null> {
  const browser = await getBrowser();
  const context = await browser.newContext({ userAgent, javaScriptEnabled: true });
  const page = await context.newPage();
  try {
    const res = await page.goto(url, { timeout: RENDER_TIMEOUT_MS, waitUntil: 'domcontentloaded' });
    if (!res) return null;
    await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => {});
    await page.waitForTimeout(SETTLE_MS);
    const body = await page.content();
    return { status: res.status(), body, finalUrl: page.url() };
  } catch {
    return null;
  } finally {
    await context.close().catch(() => {});
  }
}
