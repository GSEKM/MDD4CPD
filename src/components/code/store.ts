// store.ts
import { derived, writable } from 'svelte/store';
import type { Edge, Node } from '@xyflow/svelte';
import type { Problem } from '../../generator/problems';

export const edges = writable<Edge[]>([]);
export const nodes = writable<Node[]>([]);

/** Problems of the last code generation. */
export const problems = writable<Problem[]>([]);

/** node id -> problems reported on that node */
export const problemsByNode = derived(problems, ($problems) => {
    const map = new Map<string, Problem[]>();
    $problems.forEach((p) => {
        const id = p.nodeId;
        if (!id) return;
        if (!map.has(id)) map.set(id, []);
        map.get(id)!.push(p);
    });
    return map;
});

// #region Generation trace and cross-highlighting
import type { GenerationResult, Statement } from '../../generator/generate';

export const generation = writable<GenerationResult>({ code: '', problems: [], statements: [] });

/** Statement under the pointer (canvas link or code line), if any. */
export const hoveredStatement = writable<number | null>(null);

export type LinkRole = 'lifecycle' | 'branch' | 'argument' | 'operand';
export type LinkInfo = { statement: Statement; first: boolean };

/** link id -> the statement it belongs to */
export const linkInfo = derived(generation, ($g) => {
    const map = new Map<string, LinkInfo>();
    $g.statements.forEach((s) => s.edgeIds.forEach((id, i) => map.set(id, { statement: s, first: i === 0 })));
    return map;
});

/** node id -> statements that pass through it (as source, argument or target) */
export const statementsByNode = derived(generation, ($g) => {
    const map = new Map<string, number[]>();
    const add = (id: string, s: number) => {
        if (!map.has(id)) map.set(id, []);
        if (!map.get(id)!.includes(s)) map.get(id)!.push(s);
    };
    $g.statements.forEach((s) => {
        add(s.sourceNodeId, s.id);
        s.nodeIds.forEach((n) => add(n, s.id));
    });
    return map;
});
// #endregion
