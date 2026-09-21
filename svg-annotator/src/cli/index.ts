#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { generateAsset } from '../geometry/generate.js';
import { createCatalog } from '../catalog/generator.js';
import { annotationOutputPath, renderAnnotationSvg } from '../export/annotationSvg.js';
import type { Asset, Mode } from '../types/geometry.js';

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.length < 2) {
  console.log('Usage: svg-shape-mapper <input> <output> [--mode rectangle|orthogonal|auto] [--grid 64]');
  process.exit(argv.length < 2 ? 1 : 0);
}
if (argv.includes('--version')) { console.log('1.1.0'); process.exit(0); }

const input = path.resolve(argv[0]);
const output = path.resolve(argv[1]);
const mi = argv.indexOf('--mode');
const mode: Mode = (mi >= 0 ? argv[mi + 1] : 'auto') as Mode;
if (!['rectangle', 'orthogonal', 'auto'].includes(mode)) throw Error('Invalid --mode');
const gi = argv.indexOf('--grid');
const gridSize = gi >= 0 ? Number(argv[gi + 1]) || 64 : 64;
const annotationsDir = 'svg annotations';

async function files(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(e =>
    e.isDirectory() ? files(path.join(dir, e.name)) : e.isFile() && e.name.toLowerCase().endsWith('.svg') ? [path.join(dir, e.name)] : []
  ))).flat();
}

const list = await files(input);
const assets: Asset[] = [];
console.log(`Processing ${list.length} SVG files…`);
for (let i = 0; i < list.length; i++) {
  const file = list[i];
  const rel = path.relative(input, file).split(path.sep).join('/');
  let a: Asset;
  try {
    a = generateAsset(rel, await fs.readFile(file, 'utf8'), mode, gridSize);
  } catch (e) {
    a = { id: rel, source: rel, metadata: { automatic: true, status: 'FAILED', reason: String(e) } };
  }
  assets.push(a);
  const target = path.join(output, annotationsDir, annotationOutputPath(rel));
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, renderAnnotationSvg(a));
  if ((i + 1) % 100 === 0 || i + 1 === list.length) console.log(`${i + 1}/${list.length}`);
}

await fs.mkdir(output, { recursive: true });
const catalog = createCatalog(assets, mode);
await fs.writeFile(path.join(output, 'catalog.json'), JSON.stringify(catalog, null, 2) + '\n');
const failed = assets.filter(a => a.metadata.status === 'FAILED');
const review = assets.filter(a => a.metadata.status === 'REVIEW_REQUIRED');
const orthogonal = assets.filter(a => a.geometry?.type === 'orthogonal-polygon');
const report = {
  total: assets.length,
  successful: assets.length - failed.length - review.length,
  reviewRequired: review.length,
  failed: failed.length,
  rectangles: assets.filter(a => a.geometry?.type === 'rectangle').length,
  orthogonalPolygons: orthogonal.length,
  annotationsDir,
  errors: assets.filter(a => a.metadata.reason).map(a => ({ source: a.source, status: a.metadata.status, reason: a.metadata.reason })),
};
await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`Complete: ${report.successful} successful, ${report.reviewRequired} review, ${report.failed} failed`);
console.log(`Annotations: ${path.join(output, annotationsDir)} (${report.rectangles} rectangles, ${report.orthogonalPolygons} orthogonal polygons)`);
