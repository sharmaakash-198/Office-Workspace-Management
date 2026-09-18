import type { Geometry, Point } from '../types/geometry.js';
const eq=(a:number,b:number)=>Math.abs(a-b)<1e-8;
export function validateGeometry(g: Geometry): string | undefined {
  const points: Point[] = g.type==='rectangle' ? [[g.x,g.y],[g.x+g.width,g.y],[g.x+g.width,g.y+g.height],[g.x,g.y+g.height]] : g.points;
  if (g.type==='rectangle' && (g.width<=0 || g.height<=0)) return 'Rectangle must have positive area';
  if (points.length<4) return 'Polygon needs at least four vertices';
  if (points.some(([x,y])=>x<0||x>1||y<0||y>1)) return 'Coordinates must be normalized';
  let area=0;
  for(let i=0;i<points.length;i++){ const a=points[i], b=points[(i+1)%points.length]; if(!(eq(a[0],b[0])||eq(a[1],b[1]))) return 'Diagonal edge'; if(eq(a[0],b[0])&&eq(a[1],b[1])) return 'Zero-length edge'; area+=a[0]*b[1]-b[0]*a[1]; }
  if(Math.abs(area)<1e-10) return 'Zero area';
  for(let i=0;i<points.length;i++){const a=points[(i+points.length-1)%points.length],b=points[i],c=points[(i+1)%points.length]; if((eq(a[0],b[0])&&eq(b[0],c[0]))||(eq(a[1],b[1])&&eq(b[1],c[1]))) return 'Non-right angle';}
  return undefined;
}
