import type { Node, Edge } from '@xyflow/svelte';

export const initialNodes: Node[] = [
    {
        id: "1b",
        type: "modal",
        data: {
            text: "hello",
        },
        position: { x: -100, y: -50 },
    },

    {
        id: "3b",
        type: "result",
        data: {},
        position: { x: 300, y: 50 },
    }
];

export const initialEdges: Edge[] = [
  {
    id: 'e1-2',
    source: '1b',
    target: '3b',
    data: {
      label: 'edge label'
    },
    type: 'customEdge'
  },

];