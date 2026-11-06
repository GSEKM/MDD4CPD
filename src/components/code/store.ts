// store.ts
import { writable } from 'svelte/store';
import type { Edge, Node } from '@xyflow/svelte';

export const edges = writable<Edge[]>([]);
export const nodes = writable<Node[]>([]);
