// Applies a diagram imported from edited code onto the diagram on the canvas,
// keeping what the code does not describe: block ids, positions and link ids.
//
// Blocks are matched deterministically by their identity in the code:
//   pass 1: palette name + identity (instance/variable/constant/function
//           name, value, ...), k-th occurrence with k-th occurrence;
//   pass 2: palette name alone, among blocks still unmatched (e.g. a Servo
//           block without a custom instance name becomes "myServo").
// Matched blocks keep id, position and origin; their data comes from the
// code. New blocks are placed next to an already placed neighbour, using the
// importer's layout for the relative offset.

import type { DEdge, DNode, Diagram } from "../generator/graph";

type Pos = { x: number; y: number };

/** What a block is in the code (empty for blocks identified only by their kind). */
export function identity(n: DNode): string {
    const d = n.data ?? {};
    const x = d.extras ?? {};
    switch (x.type) {
        case "controller":
            return "";
        case "component":
            return x.instanceName ?? "";
        case "variable":
        case "constant":
            return x.name ?? "";
        case "port":
            return String(x.value ?? "");
        case "parameter":
            return `${x.returnType ?? ""}:${x.value ?? ""}`;
        default:
            // Function: its name; Condition/While: the operator; built-ins: none
            return d.name === "Function" ? String(x.value ?? "") : "";
    }
}

const kind = (n: DNode) => (n.data?.extras?.type === "controller" ? "controller" : `${n.data?.extras?.type}/${n.data?.name}`);

export type MergeResult = { diagram: Diagram; matched: number; added: number; removed: number };

export function mergeDiagram(current: Diagram, imported: Diagram): MergeResult {
    const ids = new Map<string, string>(); // imported id -> current id
    const used = new Set<string>();

    const pass = (key: (n: DNode) => string) => {
        const pool = new Map<string, DNode[]>();
        current.nodes.forEach((n) => {
            if (used.has(n.id)) return;
            const k = key(n);
            if (!pool.has(k)) pool.set(k, []);
            pool.get(k)!.push(n);
        });
        imported.nodes.forEach((n) => {
            if (ids.has(n.id)) return;
            const match = pool.get(key(n))?.shift();
            if (!match) return;
            ids.set(n.id, match.id);
            used.add(match.id);
        });
    };
    pass((n) => `${kind(n)}\u0000${identity(n)}`);
    pass(kind);

    const byId = new Map(current.nodes.map((n) => [n.id, n]));
    const taken = new Set(current.nodes.map((n) => n.id));
    let next = 0;
    const freshId = (prefix: string) => {
        let id: string;
        do id = `${prefix}${++next}`;
        while (taken.has(id));
        taken.add(id);
        return id;
    };
    imported.nodes.forEach((n) => {
        if (!ids.has(n.id)) ids.set(n.id, freshId("code-"));
    });

    // Positions: matched blocks stay; new ones go next to a placed neighbour.
    const placed = new Map<string, Pos>(); // imported id -> canvas position (top-left)
    const imp = new Map(imported.nodes.map((n) => [n.id, n.position ?? { x: 0, y: 0 }]));
    imported.nodes.forEach((n) => {
        const old = byId.get(ids.get(n.id)!);
        if (old) placed.set(n.id, topLeft(old));
    });
    const deltas = [...placed].map(([id, p]) => ({ x: p.x - imp.get(id)!.x, y: p.y - imp.get(id)!.y }));
    const global = deltas.length ? { x: median(deltas.map((d) => d.x)), y: median(deltas.map((d) => d.y)) } : { x: 0, y: 0 };
    const neighbours = (id: string) =>
        imported.edges.flatMap((e) => (e.source === id ? [e.target] : e.target === id ? [e.source] : []));
    // Repeat so that chains of new blocks are placed relative to each other.
    let pending = imported.nodes.filter((n) => !placed.has(n.id));
    while (pending.length) {
        const before = pending.length;
        pending = pending.filter((n) => {
            const anchor = neighbours(n.id).find((m) => placed.has(m));
            if (!anchor) return true;
            const a = placed.get(anchor)!;
            const ai = imp.get(anchor)!;
            const p = imp.get(n.id)!;
            placed.set(n.id, { x: a.x + p.x - ai.x, y: a.y + p.y - ai.y });
            return false;
        });
        if (pending.length === before) {
            pending.forEach((n) => {
                const p = imp.get(n.id)!;
                placed.set(n.id, { x: p.x + global.x, y: p.y + global.y });
            });
            break;
        }
    }

    const nodes: DNode[] = imported.nodes.map((n) => {
        const id = ids.get(n.id)!;
        const old: any = byId.get(id);
        const p = placed.get(n.id)!;
        if (old) {
            // keep the old origin; convert the top-left position back to it
            const [ox, oy] = old.origin ?? [0, 0];
            const w = old.computed?.width ?? old.measured?.width ?? 0;
            const h = old.computed?.height ?? old.measured?.height ?? 0;
            return { ...n, id, type: old.type ?? "custom", origin: old.origin, position: { x: p.x + ox * w, y: p.y + oy * h } } as DNode;
        }
        return { ...n, id, type: "custom", position: p } as DNode;
    });

    // Links: reuse the id of an identical link so the canvas keeps it.
    const oldEdges = new Map<string, DEdge[]>();
    current.edges.forEach((e) => {
        const k = edgeKey(e);
        if (!oldEdges.has(k)) oldEdges.set(k, []);
        oldEdges.get(k)!.push(e);
    });
    const edgeIds = new Set(current.edges.map((e) => e.id));
    let nextEdge = 0;
    const edges: DEdge[] = imported.edges.map((e) => {
        const mapped = { ...e, source: ids.get(e.source)!, target: ids.get(e.target)! };
        const same = oldEdges.get(edgeKey(mapped))?.shift();
        let id = same?.id;
        if (!id) {
            do id = `code-e${++nextEdge}`;
            while (edgeIds.has(id));
            edgeIds.add(id);
        }
        return { ...mapped, id };
    });

    const kept = new Set(nodes.map((n) => n.id));
    return {
        diagram: { nodes, edges },
        matched: used.size,
        added: nodes.length - used.size,
        removed: current.nodes.filter((n) => !kept.has(n.id)).length,
    };
}

function topLeft(n: any): Pos {
    const [ox, oy] = n.origin ?? [0, 0];
    const w = n.computed?.width ?? n.measured?.width ?? 0;
    const h = n.computed?.height ?? n.measured?.height ?? 0;
    const p = n.position ?? { x: 0, y: 0 };
    return { x: p.x - ox * w, y: p.y - oy * h };
}

function median(xs: number[]) {
    const s = [...xs].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
}

function edgeKey(e: DEdge) {
    return [e.source, e.sourceHandle ?? "", e.target, e.targetHandle ?? ""].join("\u0000");
}

// #region Code edits
import { importSketch, type ImportNote, type SketchImport } from "./ino";
import { generateCode } from "../generator/generate";

export type EditOutcome =
    /** The code describes the same program as the canvas: nothing to do. */
    | { kind: "unchanged"; result: SketchImport }
    /** The canvas can follow the code. */
    | { kind: "apply"; result: SketchImport; merge: MergeResult; code: string }
    /** Parts of the code have no block equivalent; applying would drop them. */
    | { kind: "blocked"; result: SketchImport; reasons: ImportNote[]; merge: MergeResult; code: string };

/** Decides what an edit of the code does to the diagram on the canvas. */
export function evaluateEdit(text: string, current: Diagram, palette: any[]): EditOutcome {
    const result = importSketch(text, palette);
    const code = generateCode(result.diagram).code;
    const before = current.nodes.length ? generateCode(current).code : "";
    const reasons = [
        ...result.missingIncludes.map((h) => ({ line: 0, severity: "warning" as const, message: `No block provides ${h}` })),
        ...result.notes.filter((n) => n.severity === "warning"),
    ];
    const merge = () => mergeDiagram(current, result.diagram);
    if (reasons.length) return { kind: "blocked", result, reasons, merge: merge(), code };
    if (code === before) return { kind: "unchanged", result };
    return { kind: "apply", result, merge: merge(), code };
}
// #endregion
