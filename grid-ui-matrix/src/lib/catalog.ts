import type { CatalogCategory, LibraryItem } from '../types/geometry';

export type LibraryCatalog = {
  categories: CatalogCategory[];
};

let cached: LibraryCatalog | null = null;

export async function loadCatalog(): Promise<LibraryCatalog> {
  if (cached) return cached;
  const res = await fetch('/library-catalog.json');
  if (!res.ok) throw new Error(`Failed to load catalog: ${res.status}`);
  const data = (await res.json()) as LibraryCatalog;
  cached = data;
  return data;
}

export function catalogToLibraryItems(catalog: LibraryCatalog): LibraryItem[] {
  const items: LibraryItem[] = [];
  for (const cat of catalog.categories) {
    for (const t of cat.types) {
      items.push({
        id: `${cat.category}:${t.elementType}`,
        category: cat.category,
        elementType: t.elementType,
        label: t.label,
        widthCells: t.widthCells,
        heightCells: t.heightCells,
        color: t.color,
        svg: t.svg,
        defaultFontSize: cat.category === 'text' ? 0.6 : undefined,
      });
    }
  }
  return items;
}

export function assetUrl(svg?: string): string | undefined {
  if (!svg) return undefined;
  return `/assets/${svg}`;
}
