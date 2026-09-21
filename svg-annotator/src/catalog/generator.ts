import type { Asset, Catalog, Mode } from '../types/geometry.js';
import { generateAsset } from '../geometry/generate.js';

export const createCatalog = (assets: Asset[], mode: Mode): Catalog => ({
  version: '1.5',
  generatedAt: new Date().toISOString(),
  settings: { geometryMode: mode, coordinateSystem: 'normalized', orthogonalOnly: true },
  assets,
});

export const processText = (source: string, svg: string, mode: Mode) => generateAsset(source, svg, mode);
