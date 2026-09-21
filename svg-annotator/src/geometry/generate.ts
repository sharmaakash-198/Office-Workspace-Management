import { svgGridAsset } from '../svg/gridFootprint.js';
import type { Asset, Mode } from '../types/geometry.js';

/** CLI/entry SVG annotation: grid-filled silhouette with minimal-side auto geometry. */
export function generateAsset(source: string, svg: string, mode: Mode = 'auto', gridSize = 64): Asset {
  return svgGridAsset(source, svg, mode, gridSize);
}
