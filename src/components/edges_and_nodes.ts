import type { Node, Edge } from '@xyflow/svelte';
import { writable } from 'svelte/store';

export const initialNodes: Node[]= [
    {
        id: "3b",
        type: "result",
        data: {},
        position: { x: 300, y: 50 },
    }
  ];

export const initialEdges: Edge[] = [

];