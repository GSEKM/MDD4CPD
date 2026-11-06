// store.ts
import { derived, writable } from 'svelte/store';
import type { Edge, Node } from '@xyflow/svelte';
import type { Problem } from './code';

export const edges = writable<Edge[]>([]);
export const nodes = writable<Node[]>([]);

/** Problems of the last code generation. */
export const problems = writable<Problem[]>([]);

/** node id -> problems reported on that node */
export const problemsByNode = derived(problems, ($problems) => {
    const map = new Map<string, Problem[]>();
    $problems.forEach((p) => {
        const id = p.node?.id;
        if (!id) return;
        if (!map.has(id)) map.set(id, []);
        map.get(id)!.push(p);
    });
    return map;
});
