<script lang="ts">
    import "@xyflow/svelte/dist/style.css";
    import {
        SvelteFlow,
        Controls,
        Background,
        BackgroundVariant,
        MiniMap,
        useSvelteFlow,
        type ColorMode,
        type Node,
        type NodeTypes,
    } from "@xyflow/svelte";
    //@ts-ignore
    import Sidebar from "./components/sidebar/Sidebar.svelte";
    import paletteNodes from "./nodes.json";
    //@ts-ignore
    import CustomNode from "./components/nodes/CustomNode.svelte";
    import { edges, nodes } from "./components/code/store";
    import { generateCode } from "./components/code/code";
    import CodeViewer from "./components/codeViewer/codeViewer.svelte";
    // Initialize SvelteFlow hook
    const { screenToFlowPosition } = useSvelteFlow();

    // Specify node types
    const nodeTypes: NodeTypes = {
        custom: CustomNode,
    };

    // Drag and drop handlers
    const onDragOver = (event: DragEvent) => {
        event.preventDefault();
        if (event.dataTransfer) {
            event.dataTransfer.dropEffect = "move";
        }
    };

    const onDrop = (event: DragEvent) => {
        if (!event.dataTransfer) {
            return;
        }

        const data = event.dataTransfer.getData("application/svelteflow");
        if (!data) return; // not dragged from the palette
        const position = screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
        });

        const nodeData = JSON.parse(data);
        // Defaults of the original tool (MyEditableNodeModel)
        if (nodeData.extras && nodeData.extras.type !== "controller") {
            nodeData.extras.returnType = nodeData.extras.returnType || "byte";
            if (nodeData.extras.hasValue && nodeData.extras.value === undefined)
                nodeData.extras.value = "";
        }

        const newNode: Node = {
            id: `${Math.random()}`,
            type: "custom",
            position,
            origin: [0.5, 0.0],
            data: nodeData,
        };

        nodes.update((n) => [...n, newNode]);
    };

    // Code is regenerated on every diagram change, as in the original tool.
    $: result = generateCode({ nodes: $nodes, edges: $edges });

    let colorMode: ColorMode = "dark";
</script>

<main>
    <Sidebar nodes={paletteNodes} />
    <SvelteFlow
        {nodes}
        {edges}
        {nodeTypes}
        {colorMode}
        on:dragover={onDragOver}
        on:drop={onDrop}
    >
        <Controls />
        <Background variant={BackgroundVariant.Dots} />
        <MiniMap pannable zoomable />
    </SvelteFlow>
    <CodeViewer code={result.code} problems={result.problems} />
</main>

<style>
    main {
        height: 100vh;
        display: flex;
    }
</style>
