// store.ts
import { writable } from 'svelte/store';
import type { Edge, Node } from '@xyflow/svelte';

export const edges = writable<Edge[]>([]);
export const nodes = writable<Node[]>([]);
export const globalCode = writable('');


export const updateGlobalCode = (code: string) => {
    globalCode.set(code);
    console.log('Code updated: ' + code);
};

export const getGlobalCode = () => {
    return globalCode;
};
