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

Sweep writes results.jsonl (every scan) and findings.jsonl (only scans with findings).`);
  process.exit(1);
}

function summarize(r: ScanResult): string {
  if (r.error) return `ERR   ${r.url} (${r.error})`;
  const high = r.findings.filter((f) => f.confidence === 'high').length;
  const med = r.findings.filter((f) => f.confidence === 'medium').length;
  const info = r.findings.filter((f) => f.confidence === 'info').length;
  const marks = [
    high ? `HIGH:${high}` : '',
    med ? `med:${med}` : '',
    info ? `info:${info}` : '',
    r.llmsTxt.present ? 'llms.txt' : '',
  ].filter(Boolean).join(' ');
  return `${high ? 'FLAG ' : 'ok   '} ${r.url} ${marks}`;
}

async function main() {
  const [cmd, target, ...rest] = process.argv.slice(2);
  if (!cmd || !target) usage();

  if (cmd === 'scan') {
    const result = await scanSite(target);
    console.log(JSON.stringify(result, null, 2));
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

    console.log(`Sweeping ${domains.length} sites (${done.size} already done), concurrency ${CONCURRENCY}`);
    let scanned = 0;
    let flagged = 0;
    const queue = [...domains];
    const worker = async () => {
      for (;;) {
        const domain = queue.shift();
        if (!domain) return;
        const r = await scanSite(domain);
        appendFileSync(resultsPath, JSON.stringify(r) + '\n');
        if (r.findings.length || r.llmsTxt.findings.length) {
          appendFileSync(findingsPath, JSON.stringify(r) + '\n');
          if (r.findings.some((f) => f.confidence === 'high')) flagged++;
        }
        scanned++;
        if (scanned % 25 === 0 || r.findings.some((f) => f.confidence === 'high')) {
          console.log(`[${scanned}/${domains.length}] ${summarize(r)}`);
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    console.log(`Done. ${scanned} scanned, ${flagged} with high-confidence findings.`);
    console.log(`Results: ${resultsPath}\nFindings: ${findingsPath}`);
    return;
  }

  usage();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
