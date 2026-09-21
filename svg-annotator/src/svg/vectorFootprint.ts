import { svgGridAsset } from './gridFootprint.js';
import type { Asset, Mode } from '../types/geometry.js';

/** @deprecated Prefer svgGridAsset — kept as a thin alias for older imports. */
export function svgVectorAsset(source: string, svg: string, mode: Mode, gridSize = 64): Asset {
  return svgGridAsset(source, svg, mode, gridSize);
}
