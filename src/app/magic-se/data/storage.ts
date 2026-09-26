import type { PlacedNode, Connection } from './nodeLibrary';

const SAVE_KEY = 'magic-se-blueprint-v1';
const FAV_KEY = 'magic-se-favorites-v1';
const TABS_KEY = 'magic-se-tabs-v1';

export interface BlueprintData {
  placed: PlacedNode[];
  connections: Connection[];
  savedAt: number;
}

export interface TabData {
  id: string;
  name: string;
  placed: PlacedNode[];
  connections: Connection[];
}

/* ==================== 蓝图保存 ==================== */
export function saveBlueprint(placed: PlacedNode[], connections: Connection[]) {
  try {
    const data: BlueprintData = { placed, connections, savedAt: Date.now() };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

export function loadBlueprint(): BlueprintData | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function exportBlueprint(placed: PlacedNode[], connections: Connection[]) {
  const data = { placed, connections, version: 1, exportedAt: Date.now() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `magic-se-blueprint-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importBlueprint(file: File): Promise<BlueprintData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (!data.placed || !data.connections) throw new Error('无效的蓝图文件');
        resolve(data);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

/* ==================== 收藏夹 ==================== */
export function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

export function saveFavorites(ids: string[]) {
  try { localStorage.setItem(FAV_KEY, JSON.stringify(ids)); } catch { /* ignore */ }
}

/* ==================== 多标签页 ==================== */
export function loadTabs(): TabData[] {
  try {
    const raw = localStorage.getItem(TABS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch { return []; }
}

export function saveTabs(tabs: TabData[]) {
  try { localStorage.setItem(TABS_KEY, JSON.stringify(tabs)); } catch { /* ignore */ }
}