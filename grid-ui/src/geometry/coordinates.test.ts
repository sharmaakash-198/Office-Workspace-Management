import { describe, expect, it } from 'vitest';
import {
  clampZoomAround,
  fitFloorViewport,
  getViewportTransform,
  initialCloseUpViewport,
  minZoomToFitFloor,
  screenToWorld,
  worldToScreen,
  zoomAround,
} from './coordinates';
import type { Viewport } from '../types/viewport';

describe('worldToScreen / screenToWorld', () => {
  const viewport: Viewport = { zoom: 20, panX: 50, panY: 700 };

  it('are exact inverses', () => {
    const world = { x: 12.5, y: 7.25 };
    const screen = worldToScreen(world, viewport);
    const back = screenToWorld(screen, viewport);
    expect(back.x).toBeCloseTo(world.x, 9);
    expect(back.y).toBeCloseTo(world.y, 9);
  });

  it('flips Y so increasing world Y moves up the screen', () => {
    const low = worldToScreen({ x: 0, y: 0 }, viewport);
    const high = worldToScreen({ x: 0, y: 10 }, viewport);
    expect(high.y).toBeLessThan(low.y);
  });

  it('matches the SVG group transform for the same point', () => {
    const world = { x: 3, y: 4 };
    const expected = {
      x: world.x * viewport.zoom + viewport.panX,
      y: -world.y * viewport.zoom + viewport.panY,
    };
    expect(worldToScreen(world, viewport)).toEqual(expected);
    expect(getViewportTransform(viewport)).toBe('translate(50, 700) scale(20, -20)');
  });
});

describe('zoomAround', () => {
  const viewport: Viewport = { zoom: 10, panX: 100, panY: 500 };

  it('keeps the world point under the anchor fixed on screen', () => {
    const anchor = { x: 240, y: 180 };
    const worldBefore = screenToWorld(anchor, viewport);
    const next = zoomAround(viewport, 2.5, anchor);
    const worldAfter = screenToWorld(anchor, next);
    expect(worldAfter.x).toBeCloseTo(worldBefore.x, 9);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y, 9);
    expect(next.zoom).toBeCloseTo(25, 9);
  });
});

describe('fit / close-up camera', () => {
  const floor = { width: 64, height: 64, a: 0.25 };

  it('minZoomToFitFloor is smaller than close-up zoom', () => {
    const minZ = minZoomToFitFloor(floor, 1200, 800);
    const close = initialCloseUpViewport(floor, 1200, 800);
    expect(close.zoom).toBeGreaterThan(minZ);
  });

  it('fitFloorViewport centers the floor', () => {
    const fit = fitFloorViewport(floor, 800, 600);
    expect(fit.zoom).toBeCloseTo(minZoomToFitFloor(floor, 800, 600), 9);
  });

  it('clampZoomAround respects min/max', () => {
    const v: Viewport = { zoom: 50, panX: 100, panY: 100 };
    const clamped = clampZoomAround(v, 1, { x: 100, y: 100 }, 10, 200);
    expect(clamped.zoom).toBe(10);
  });
});
