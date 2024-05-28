<script lang="ts">
    import "@xyflow/svelte/dist/style.css";
    import { writable } from "svelte/store";
    import {
        SvelteFlow,
        Controls,
        Background,
        BackgroundVariant,
        MiniMap,
        useSvelteFlow,
        type Edge,
        type EdgeTypes,
        type Node,
        type NodeTypes,
    } from "@xyflow/svelte";
    import Sidebar from "../src/example/Sidebar.svelte";
    import paletteNodes from "../src/nodes.json";

    import ModalNode from "./example/ModalNode.svelte";
    import CustomNode from "./example/CustomNode.svelte";
    import ResultNode from "./example/ResultNode.svelte";
    import CustomEdge from "./example/CustomEdge.svelte";

    import { initialNodes, initialEdges } from './example/edges_and_nodes';

    // Define edge and node types
        const edgeTypes: EdgeTypes = {
        customEdge: CustomEdge,
    };
    
    const { getEdges } = useSvelteFlow();
    const allEdges = getEdges([]);

    console.log(allEdges)
    const nodes = writable<Node[]>(initialNodes);
    const edges = writable<Edge[]>(initialEdges.map(edge => ({ ...edge, type: 'customEdge' })));
    

    const nodeTypes: NodeTypes = {
        modal: ModalNode,
        custom: CustomNode,
        result: ResultNode,
    };

    // Initialize SvelteFlow hook
    const { screenToFlowPosition } = useSvelteFlow();

    // Drag and drop handlers
    const onDragOver = (event: DragEvent) => {
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = "move";
        }
    };

    const onDrop = (event: DragEvent) => {
        event.preventDefault();
        if (!event.dataTransfer) {
            return;
        }

        const data = event.dataTransfer.getData("application/svelteflow");
        const position = screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
        });

        const newNode: Node = {
            id: `${Math.random()}`,
            type: "custom",
            
            position,
            origin: [0.5, 0.0],
            data: JSON.parse(data),
        };


        nodes.update(n => [...n, newNode]);
    };

    // Edge click handler
    const onEdgeClick = (event: CustomEvent<{ edge: Edge, event: MouseEvent | TouchEvent }>) => {
        const edge = event.detail.edge;

        const newNode: Node = {
            id: `${Math.random()}`,
            type: "modal",
            data: {
                text: "Insira o conteudo da string",
            },
            position: { x: 0, y: 0 },
        };

        nodes.update(n => [...n, newNode]);
    };
</script>

<main>
    <SvelteFlow
        {nodes}
        {edges}
        {nodeTypes}
        {edgeTypes}
        fitView
        on:dragover={onDragOver}
        on:drop={onDrop}
        on:edgeclick={onEdgeClick}
    >
        <Controls />
        <Background variant={BackgroundVariant.Dots} />
        <MiniMap />
    </SvelteFlow>
    <Sidebar nodes={paletteNodes} />
</main>

<style>
    main {
        height: 100vh;
        display: flex;
    }
</style>
