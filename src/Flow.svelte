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
        type Node,
        type NodeTypes,
    } from "@xyflow/svelte";
    import Sidebar from "../src/example/Sidebar.svelte";
    import paletteNodes from "../src/nodes.json";

    import TextNode from "./example/TextNode.svelte";
    import CustomNode from "./example/CustomNode.svelte";
    import UppercaseNode from "./example/UppercaseNode.svelte";
    import ResultNode from "./example/ResultNode.svelte";

    const nodeTypes: NodeTypes = {
        text: TextNode,
        custom: CustomNode,
        uppercase: UppercaseNode,
        result: ResultNode,
    };

    const nodes = writable([
        {
            id: "1",
            type: "input",
            data: { label: "Input Node" },
            position: { x: 150, y: 5 },
        },
        {
            id: "2",
            type: "default",
            data: { label: "Default Node" },
            position: { x: 0, y: 150 },
        },
        {
            id: "3",
            type: "output",
            data: { label: "Output Node" },
            position: { x: 300, y: 150 },
        },
        {
            id: "1b",
            type: "text",
            data: {
                text: "hello",
            },
            position: { x: -100, y: -50 },
        },
        {
            id: "1ab",
            type: "uppercase",
            data: {},
            position: { x: 100, y: 0 },
        },
        {
            id: "2b",
            type: "text",
            data: {
                text: "world",
            },
            position: { x: 0, y: 100 },
        },

        {
            id: "3b",
            type: "result",
            data: {},
            position: { x: 300, y: 50 },
        },
    ]);

    const edges = writable([
        {
            id: "1-2",
            type: "default",
            source: "1",
            target: "2",
        },
        {
            id: "1-3",
            type: "smoothstep",
            source: "1",
            target: "3",
        },
        {
            id: "e1-1a",
            source: "1b",
            target: "1ab",
        },
        {
            id: "e1a-3",
            source: "1ab",
            target: "3b",
        },
        {
            id: "e2-3",
            source: "2b",
            target: "3b",
        },
    ]);

    const { screenToFlowPosition } = useSvelteFlow();
    const onDragOver = (event: DragEvent) => {
        event.preventDefault();

        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = "move";
        }
    };

    const onDrop = (event: DragEvent) => {
        event.preventDefault();

        if (!event.dataTransfer) {
            return null;
        }

        const data = event.dataTransfer.getData("application/svelteflow");
        console.log(data);
        const position = screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
        });

        const newNode = {
            id: `${Math.random()}`,
            type: `custom`,
            position,
            origin: [0.5, 0.0],
            data: JSON.parse(data),
        } satisfies Node;

        $nodes.push(newNode);
        $nodes = $nodes;
    };
</script>

<main>
    <SvelteFlow
        {nodes}
        {edges}
        {nodeTypes}
        fitView
        on:dragover={onDragOver}
        on:drop={onDrop}
    >
        <Controls />
        <Background variant={BackgroundVariant.Dots} />
        <MiniMap />
    </SvelteFlow>
    <Sidebar nodes={paletteNodes.slice(0, 5)} />
</main>

<style>
    main {
        height: 100vh;
        display: flex;
        flex-direction: column-reverse;
    }
</style>
