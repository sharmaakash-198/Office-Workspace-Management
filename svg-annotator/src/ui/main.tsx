import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { imageAsset } from '../raster/silhouette';
import { svgGridAsset } from '../svg/gridFootprint';
import { validateGeometry } from '../geometry/validator';
import { annotationOutputPath, renderAnnotationSvg } from '../export/annotationSvg';
import { zipStore } from '../export/zip';
import type { Asset, Geometry, Mode, Point } from '../types/geometry';
import './style.css';

type LocalAsset = Asset & { file: File; url: string; raster?: ImageData };
const supported = /\.(svg|png|jpe?g)$/i;
const clamp = (n: number) => Math.min(1, Math.max(0, Number.isFinite(n) ? n : 0));
const number = (value: string) => Number.parseFloat(value);
type Rasterized = { data: ImageData; previewUrl: string };

async function rasterize(file: File): Promise<Rasterized> {
  const sourceUrl = URL.createObjectURL(file), image = new Image();
  try {
    image.src = sourceUrl; await image.decode();
    const scale = Math.min(1, 768 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true })!;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = context.getImageData(0, 0, canvas.width, canvas.height);
    const preview = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not create preview')), 'image/png'));
    return { data, previewUrl: URL.createObjectURL(preview) };
  } finally { URL.revokeObjectURL(sourceUrl); }
}

function App() {
  const [assets, setAssets] = useState<LocalAsset[]>([]), [selected, setSelected] = useState(0), [mode, setMode] = useState<Mode>('auto'), [threshold, setThreshold] = useState(30), [gridSize, setGridSize] = useState(64), [showImage, setShowImage] = useState(true), [showGeometry, setShowGeometry] = useState(true), [showGrid, setShowGrid] = useState(false), [busy, setBusy] = useState(false), [progress, setProgress] = useState('');
  const asset = assets[selected];
  const update = (change: (asset: LocalAsset) => LocalAsset) => setAssets(previous => previous.map((item, index) => index === selected ? change(item) : item));
  const commit = (geometry: Geometry, label = asset?.label) => update(item => {
    const reason = validateGeometry(geometry, item.metadata.unitGrid?.cellsPerLongSide ?? 1);
    return reason
      ? { ...item, metadata: { ...item.metadata, status: 'REVIEW_REQUIRED', reason: `Edit rejected: ${reason}` } }
      : { ...item, label, geometry, metadata: { ...item.metadata, automatic: false, status: 'REVIEWED', reason: undefined } };
  });
  const processFile = async (file: File, source: string): Promise<LocalAsset> => {
    const label = file.name.replace(/\.[^/.]+$/, '');
    try {
      if (/\.svg$/i.test(file.name)) {
        const annotation = svgGridAsset(source, await file.text(), mode, gridSize);
        try {
          const raster = await rasterize(file);
          return { ...annotation, file, url: raster.previewUrl, raster: raster.data };
        } catch {
          return { ...annotation, file, url: '' };
        }
      }
      const raster = await rasterize(file);
      return { ...imageAsset(source, raster.data, mode, { threshold, gridSize }), file, url: raster.previewUrl, raster: raster.data };
    } catch (error) {
      return { id: source.replace(/\.[^/.]+$/, ''), source, label, file, url: '', metadata: { automatic: true, status: 'FAILED', reason: `Could not process image: ${error instanceof Error ? error.message : String(error)}` } };
    }
  };
  const scan = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter(file => supported.test(file.name));
    setBusy(true); setAssets([]); setSelected(0);
    try {
      const mapped: LocalAsset[] = [];
      for (let index = 0; index < files.length; index++) {
        const file = files[index], source = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        setProgress(`Processing ${index + 1} / ${files.length}: ${file.name}`);
        mapped.push(await processFile(file, source));
        setAssets([...mapped]);
        await new Promise<void>(resolve => setTimeout(resolve, 0));
      }
      setProgress(`Processed ${mapped.length} image${mapped.length === 1 ? '' : 's'}`);
    } finally { setBusy(false); event.target.value = ''; }
  };
  const regenerate = async () => {
    if (!asset) return;
    setBusy(true); setProgress(`Regenerating ${asset.label}…`);
    try {
      URL.revokeObjectURL(asset.url);
      const updated = await processFile(asset.file, asset.source);
      setAssets(previous => previous.map((item, index) => index === selected ? updated : item));
      setProgress('Regenerated selected image');
    } finally { setBusy(false); }
  };
  const download = () => {
    const catalog = {
      version: '1.5',
      generatedAt: new Date().toISOString(),
      settings: { geometryMode: mode, threshold, cellsPerLongSide: gridSize, coordinateSystem: 'integer-square-grid-units', orthogonalOnly: true, minimalSides: true },
      assets: assets.map(({ file, url, raster, ...item }) => item),
    };
    const zipFiles = [
      { name: 'catalog.json', content: JSON.stringify(catalog, null, 2) },
      ...assets.map(item => ({
        name: `svg annotations/${annotationOutputPath(item.source)}`,
        content: renderAnnotationSvg(item),
      })),
    ];
    const url = URL.createObjectURL(zipStore(zipFiles));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'catalog.zip';
    link.click();
    URL.revokeObjectURL(url);
  };
  const frame = useMemo(() => {
    const raster = asset?.raster;
    const grid = asset?.metadata.unitGrid;
    const width = raster ? raster.width / Math.max(raster.width, raster.height) : grid ? grid.columns / grid.cellsPerLongSide : 1;
    const height = raster ? raster.height / Math.max(raster.width, raster.height) : grid ? grid.rows / grid.cellsPerLongSide : 1;
    return { x: (1 - width) / 2, y: (1 - height) / 2, width, height };
  }, [asset]);
  const overlay = useMemo(() => {
    if (!asset?.geometry) return null;
    const g = asset.geometry, scale = asset.metadata.unitGrid?.cellsPerLongSide ?? 1;
    const points: Point[] = g.type === 'rectangle'
      ? [[g.x, g.y], [g.x + g.width, g.y], [g.x + g.width, g.y + g.height], [g.x, g.y + g.height]]
      : g.points;
    return <>
      <g transform={`translate(${frame.x} ${frame.y}) scale(${1 / scale})`}>
        <polygon points={points.map(point => point.join(',')).join(' ')} />
        {points.map((point, index) => <circle key={index} cx={point[0]} cy={point[1]} r=".65" />)}
      </g>
      <text x={frame.x + .02} y={frame.y + .05}>{asset.label}</text>
    </>;
  }, [asset, frame]);
  const g = asset?.geometry;
  return <main>
    <header>
      <h1>Image Shape Annotator</h1>
      <label>Files <input type="file" accept=".svg,.png,.jpg,.jpeg" multiple disabled={busy} onChange={scan} /></label>
      <label>Folder <input type="file" accept=".svg,.png,.jpg,.jpeg" multiple disabled={busy} {...({ webkitdirectory: '' } as object)} onChange={scan} /></label>
      <select value={mode} disabled={busy} onChange={event => setMode(event.target.value as Mode)}>
        <option value="auto">auto — minimal sides</option>
        <option value="rectangle">bounding rectangle — 4 sides</option>
        <option value="orthogonal">detailed orthogonal contour</option>
      </select>
      <label className="threshold">Sensitivity <input type="range" min="5" max="150" value={threshold} disabled={busy} onChange={event => setThreshold(+event.target.value)} /> {threshold}</label>
      <label>Square grid <select value={gridSize} disabled={busy} onChange={event => setGridSize(+event.target.value)}><option value="32">32 units</option><option value="64">64 units</option><option value="96">96 units</option></select></label>
      <button onClick={download} disabled={!assets.length}>Export catalog + SVG annotations</button>
    </header>
    <section>
      <aside>
        <b>Assets ({assets.length})</b>
        <small>{progress}</small>
        {assets.map((item, index) => <button className={index === selected ? 'active' : ''} key={item.source} onClick={() => setSelected(index)}>{item.label}<small>{item.metadata.status}</small></button>)}
      </aside>
      <article>
        {asset ? <>
          <div className="toggles">
            <label><input checked={showImage} onChange={event => setShowImage(event.target.checked)} type="checkbox" /> Image</label>
            <label><input checked={showGeometry} onChange={event => setShowGeometry(event.target.checked)} type="checkbox" /> Annotation</label>
            <label><input checked={showGrid} onChange={event => setShowGrid(event.target.checked)} type="checkbox" /> Square grid</label>
            <button onClick={regenerate} disabled={busy}>{busy ? 'Processing…' : 'Regenerate'}</button>
            <button onClick={() => update(item => ({ ...item, metadata: { ...item.metadata, automatic: false, status: 'REVIEWED', reason: undefined } }))} disabled={!g}>Mark reviewed</button>
          </div>
          <div className="stage">
            {showImage && asset.url && <img src={asset.url} />}
            {(showGeometry || showGrid) && <svg viewBox="0 0 1 1" preserveAspectRatio="xMidYMid meet">
              <defs><pattern id="unit-grid" width={1 / gridSize} height={1 / gridSize} patternUnits="userSpaceOnUse"><path d={`M ${1 / gridSize} 0 L 0 0 0 ${1 / gridSize}`} fill="none" className="grid-line" /></pattern></defs>
              {showGrid && <rect className="grid" x={frame.x} y={frame.y} width={frame.width} height={frame.height} fill="url(#unit-grid)" />}
              {showGeometry && overlay}
            </svg>}
          </div>
          <p>{g?.type ?? 'No geometry'} · {asset.metadata.status} · {asset.metadata.unitGrid ? `${asset.metadata.unitGrid.cellsPerLongSide} × ${asset.metadata.unitGrid.cellsPerLongSide} integral square-unit grid` : ''}{asset.metadata.reason ? ` · ${asset.metadata.reason}` : ''}{g?.type === 'orthogonal-polygon' ? ` · ${g.points.length} vertices` : g?.type === 'rectangle' ? ' · 4 sides' : ''}</p>
        </> : <p>Choose individual files or a folder containing SVG, PNG, or JPEG files.</p>}
      </article>
      <aside className="editor">
        {asset ? <>
          <h2>Annotation</h2>
          <label>Label <input value={asset.label ?? ''} onChange={event => update(item => ({ ...item, label: event.target.value }))} /></label>
          {g?.type === 'rectangle' && <div className="fields">{(['x', 'y', 'width', 'height'] as const).map(key => <label key={key}>{key}<input type="number" min="0" max={gridSize} step="1" value={g[key]} onChange={event => commit({ ...g, [key]: number(event.target.value) })} /></label>)}</div>}
          {g?.type === 'orthogonal-polygon' && <div className="points"><b>Vertices</b>{g.points.map((point, index) => <div key={index}><span>{index + 1}</span><input type="number" min="0" max={gridSize} step="1" value={point[0]} onChange={event => { const points = [...g.points]; points[index] = [Math.round(clamp(number(event.target.value) / gridSize) * gridSize), point[1]]; commit({ type: 'orthogonal-polygon', points }); }} /><input type="number" min="0" max={gridSize} step="1" value={point[1]} onChange={event => { const points = [...g.points]; points[index] = [point[0], Math.round(clamp(number(event.target.value) / gridSize) * gridSize)]; commit({ type: 'orthogonal-polygon', points }); }} /></div>)}</div>}
          <pre>{JSON.stringify({ label: asset.label, geometry: asset.geometry, metadata: asset.metadata }, null, 2)}</pre>
        </> : 'Generated annotation JSON appears here.'}
      </aside>
    </section>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App />);
