// Deterministic "tidy up" layout for diagrams (a small layered layout).
//
//   1. layer = longest path from a block without incoming links (cycles are
//      cut), micro-controllers always in layer 0;
//   2. within a layer, blocks are ordered by the first statement that uses
//      them (code order), then by their current vertical position, then id;
//   3. layers are columns: x advances by the widest block plus a gap, blocks
//      are stacked top-down with their measured heights; columns are centred
//      vertically. Positions returned are top-left corners.
// The same diagram (and sizes) always gives the same positions.

import type { Statement } from "../generator/generate";

type LNode = { id: string; position: { x: number; y: number }; data?: any; computed?: { width?: number; height?: number }; width?: number; height?: number };
type LEdge = { source: string; target: string };

export const COLUMN_GAP = 90;
export const ROW_GAP = 28;

export function tidyLayout(nodes: LNode[], edges: LEdge[], statements: Statement[]): Map<string, { x: number; y: number }> {
    const ids = new Set(nodes.map((n) => n.id));
    const out = new Map<string, string[]>();
    const indeg = new Map<string, number>();
    nodes.forEach((n) => {
        out.set(n.id, []);
        indeg.set(n.id, 0);
    });
    edges.forEach((e) => {
        if (!ids.has(e.source) || !ids.has(e.target) || e.source === e.target) return;
        out.get(e.source)!.push(e.target);
        indeg.set(e.target, indeg.get(e.target)! + 1);
    });

    // 1. longest-path layering (Kahn order; nodes left in cycles keep layer 0+)
    const layer = new Map<string, number>(nodes.map((n) => [n.id, 0]));
    const queue = nodes.filter((n) => indeg.get(n.id) === 0).map((n) => n.id);
    const remaining = new Map(indeg);
    for (let i = 0; i < queue.length; i++) {
        const id = queue[i];
        for (const t of out.get(id)!) {
            layer.set(t, Math.max(layer.get(t)!, layer.get(id)! + 1));
            remaining.set(t, remaining.get(t)! - 1);
            if (remaining.get(t) === 0) queue.push(t);
        }
    }
    nodes.forEach((n) => {
        if (n.data?.extras?.type === "controller") layer.set(n.id, 0);
    });

    // 2. order inside layers
    const firstUse = new Map<string, number>();
    statements.forEach((s, i) => {
        [s.sourceNodeId, ...s.nodeIds].forEach((id) => {
            if (!firstUse.has(id)) firstUse.set(id, i);
        });
    });
    const columns: LNode[][] = [];
    nodes.forEach((n) => (columns[layer.get(n.id)!] ??= []).push(n));
    const key = (n: LNode) => firstUse.get(n.id) ?? Number.MAX_SAFE_INTEGER;
    columns.forEach((col) =>
        col.sort((a, b) => key(a) - key(b) || a.position.y - b.position.y || (a.id < b.id ? -1 : 1)),
    );

    // 3. coordinates
    const size = (n: LNode) => ({
        w: n.computed?.width ?? n.width ?? 180,
        h: n.computed?.height ?? n.height ?? 120,
    });
    const result = new Map<string, { x: number; y: number }>();
    let x = 0;
    for (const col of columns) {
        if (!col) continue;
        let y = 0;
        let widest = 0;
        for (const n of col) {
            const { w, h } = size(n);
            result.set(n.id, { x, y }); // top-left corner

            y += h + ROW_GAP;
            widest = Math.max(widest, w);
        }
        x += widest + COLUMN_GAP;
    }
    // centre columns vertically on the tallest one
    const heights = columns.map((col) => (col ? col.reduce((s, n) => s + size(n).h + ROW_GAP, -ROW_GAP) : 0));
    const tallest = Math.max(0, ...heights);
    columns.forEach((col, i) => {
        if (!col) return;
        const dy = Math.round((tallest - heights[i]) / 2);
        col.forEach((n) => (result.get(n.id)!.y += dy));
    });
    return result;
}
