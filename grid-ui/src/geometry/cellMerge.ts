import type { GridCell, Rect } from '../types/geometry';

/** Merge finest cells into horizontal run rects (world units via cellSize). */
export function cellsToMergedRects(
  cells: GridCell[],
  cellSize: number,
): Rect[] {
  if (cells.length === 0) return [];
  const byRow = new Map<number, number[]>();
  for (const c of cells) {
    const list = byRow.get(c.row) ?? [];
    list.push(c.col);
    byRow.set(c.row, list);
  }
  const rects: Rect[] = [];
  for (const [row, cols] of byRow) {
    cols.sort((a, b) => a - b);
    let start = cols[0];
    let prev = cols[0];
    for (let i = 1; i <= cols.length; i++) {
      const col = cols[i];
      if (col === prev + 1) {
        prev = col;
        continue;
      }
      rects.push({
        x: start * cellSize,
        y: row * cellSize,
        width: (prev - start + 1) * cellSize,
        height: cellSize,
      });
      if (col !== undefined) {
        start = col;
        prev = col;
      }
    }
  }
  return rects;
}
