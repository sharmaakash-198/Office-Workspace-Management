import type { Geometry, Point } from '../types/geometry.js';
const eq=(a:number,b:number)=>Math.abs(a-b)<1e-8;
function intersects(a:Point,b:Point,c:Point,d:Point) { const vertical=(p:Point,q:Point)=>eq(p[0],q[0]); if(vertical(a,b)===vertical(c,d)) return false; const [v1,v2,h1,h2]=vertical(a,b)?[a,b,c,d]:[c,d,a,b]; return Math.min(v1[1],v2[1]) < h1[1]-1e-8 && Math.max(v1[1],v2[1]) > h1[1]+1e-8 && Math.min(h1[0],h2[0]) < v1[0]-1e-8 && Math.max(h1[0],h2[0]) > v1[0]+1e-8; }
export function validateGeometry(g: Geometry, maximumCoordinate = 1): string | undefined {
  const points: Point[] = g.type==='rectangle' ? [[g.x,g.y],[g.x+g.width,g.y],[g.x+g.width,g.y+g.height],[g.x,g.y+g.height]] : g.points;
  if (g.type==='rectangle' && (g.width<=0 || g.height<=0)) return 'Rectangle must have positive area';
  if (points.length<4) return 'Polygon needs at least four vertices';
  if (points.some(([x,y])=>!Number.isInteger(x)||!Number.isInteger(y))) return 'Coordinates must be whole grid units';
  if (points.some(([x,y])=>x<0||x>maximumCoordinate||y<0||y>maximumCoordinate)) return 'Coordinates outside grid';
  let area=0;
  for(let i=0;i<points.length;i++){ const a=points[i], b=points[(i+1)%points.length]; if(!(eq(a[0],b[0])||eq(a[1],b[1]))) return 'Diagonal edge'; if(eq(a[0],b[0])&&eq(a[1],b[1])) return 'Zero-length edge'; area+=a[0]*b[1]-b[0]*a[1]; }
  if(Math.abs(area)<1e-10) return 'Zero area';
  for(let i=0;i<points.length;i++){const a=points[(i+points.length-1)%points.length],b=points[i],c=points[(i+1)%points.length]; if((eq(a[0],b[0])&&eq(b[0],c[0]))||(eq(a[1],b[1])&&eq(b[1],c[1]))) return 'Non-right angle';}
  for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){if(j===i+1||(i===0&&j===points.length-1))continue;if(intersects(points[i],points[(i+1)%points.length],points[j],points[(j+1)%points.length]))return 'Self-intersection';}
  return undefined;
}
