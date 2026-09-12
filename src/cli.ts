#!/usr/bin/env node
import { readFileSync, mkdirSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { scanSite } from './scan.js';
import type { ScanResult } from './types.js';

const CONCURRENCY = 12;

function usage(): never {
  console.log(`agent-safety-scanner — finds hidden text addressing AI agents

Usage:
  agent-safety-scanner scan <url>                 Scan one site, print JSON
  agent-safety-scanner sweep <list.txt> --out <dir>   Scan a list (one domain per line)

Options (both commands):
  --render      Run each page's JavaScript in a headless browser first (slower, deeper)
  --crawl <n>   Also scan up to n same-site pages linked from the homepage

Sweep writes results.jsonl (every scan) and findings.jsonl (only scans with findings).`);
  process.exit(1);
}

/** Findings across the homepage and any crawled inner pages. */
function allFindings(r: ScanResult) {
  return [...r.findings, ...(r.pages ?? []).flatMap((p) => p.findings)];
}

function summarize(r: ScanResult): string {
  if (r.error) return `ERR   ${r.url} (${r.error})`;
  const fs = allFindings(r);
  const high = fs.filter((f) => f.confidence === 'high').length;
  const med = fs.filter((f) => f.confidence === 'medium').length;
  const info = fs.filter((f) => f.confidence === 'info').length;
  const marks = [
    high ? `HIGH:${high}` : '',
    med ? `med:${med}` : '',
    info ? `info:${info}` : '',
    r.llmsTxt.present ? 'llms.txt' : '',
    r.pages ? `pages:${r.pages.length + 1}` : '',
  ].filter(Boolean).join(' ');
  return `${high ? 'FLAG ' : 'ok   '} ${r.url} ${marks}`;
}

async function main() {
  const [cmd, target, ...rest] = process.argv.slice(2);
  if (!cmd || !target) usage();

  const render = rest.includes('--render');
  const crawlIdx = rest.indexOf('--crawl');
  const crawl = crawlIdx !== -1 ? Math.max(0, parseInt(rest[crawlIdx + 1], 10) || 0) : 0;
  const opts = { render, crawl };

  if (cmd === 'scan') {
    const result = await scanSite(target, opts);
    console.log(JSON.stringify(result, null, 2));
    if (render) (await import('./render.js')).closeBrowser();
    return;
  }

  if (cmd === 'sweep') {
    const outIdx = rest.indexOf('--out');
    const outDir = outIdx !== -1 ? rest[outIdx + 1] : 'results';
    mkdirSync(outDir, { recursive: true });
    const resultsPath = join(outDir, 'results.jsonl');
    const findingsPath = join(outDir, 'findings.jsonl');

    // resume support: skip domains already scanned
    const done = new Set<string>();
    if (existsSync(resultsPath)) {
      for (const line of readFileSync(resultsPath, 'utf8').split('\n')) {
        if (!line.trim()) continue;
        try { done.add((JSON.parse(line) as ScanResult).url); } catch { /* skip bad line */ }
      }
    }

    const domains = readFileSync(target, 'utf8')
      .split('\n')
      .map((l) => l.trim().replace(/^\d+,/, '')) // accept tranco CSV "rank,domain"
      .filter((l) => l && !l.startsWith('#') && !done.has(l));

    // Browser rendering is heavy; keep fewer pages open at once in that mode.
    const concurrency = render ? 4 : CONCURRENCY;
    console.log(`Sweeping ${domains.length} sites (${done.size} already done), concurrency ${concurrency}${render ? ', rendered' : ''}${crawl ? `, crawl ${crawl}` : ''}`);
    let scanned = 0;
    let flagged = 0;
    let renderedPages = 0;
    let fallbackPages = 0;
    const queue = [...domains];
    const worker = async () => {
      for (;;) {
        const domain = queue.shift();
        if (!domain) return;
        const r = await scanSite(domain, opts);
        appendFileSync(resultsPath, JSON.stringify(r) + '\n');
        if (allFindings(r).length || r.llmsTxt.findings.length) {
          appendFileSync(findingsPath, JSON.stringify(r) + '\n');
          if (allFindings(r).some((f) => f.confidence === 'high')) flagged++;
        }
        if (render) {
          for (const p of [r, ...(r.pages ?? [])]) {
            if (p.rendered) renderedPages++;
            if (p.renderFallback) fallbackPages++;
          }
        }
        scanned++;
        if (scanned % 25 === 0 || allFindings(r).some((f) => f.confidence === 'high')) {
          console.log(`[${scanned}/${domains.length}] ${summarize(r)}`);
        }
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
    if (render) await (await import('./render.js')).closeBrowser();
    console.log(`Done. ${scanned} scanned, ${flagged} with high-confidence findings.`);
    if (render) console.log(`Rendered: ${renderedPages} pages, fell back to raw HTML: ${fallbackPages} pages.`);
    console.log(`Results: ${resultsPath}\nFindings: ${findingsPath}`);
    return;
  }

  usage();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
