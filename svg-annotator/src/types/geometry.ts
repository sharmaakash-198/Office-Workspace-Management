export type Point = [number, number];
export type Geometry = { type: 'rectangle'; x: number; y: number; width: number; height: number } | { type: 'orthogonal-polygon'; points: Point[] };
export type Mode = 'rectangle' | 'orthogonal' | 'auto';
export type Status = 'AUTO_EXACT' | 'AUTO_BOUNDS' | 'AUTO_ORTHOGONAL' | 'REVIEWED' | 'REVIEW_REQUIRED' | 'FAILED';
export interface Asset { id: string; source: string; label?: string; geometry?: Geometry; metadata: { automatic: boolean; status: Status; reason?: string; bounds?: Bounds; unitGrid?: { cellsPerLongSide: number; cellSizePx: number; columns: number; rows: number } } }
export interface Bounds { minX: number; minY: number; maxX: number; maxY: number; width: number; height: number }
export interface Catalog { version: string; generatedAt: string; settings: { geometryMode: Mode; coordinateSystem: 'normalized'; orthogonalOnly: true }; assets: Asset[] }
