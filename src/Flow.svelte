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
        type Node,
        type NodeTypes,
    } from "@xyflow/svelte";
    import Sidebar from "./components/sidebar/Sidebar.svelte";
    import paletteNodes from "../src/nodes.json";
    import ModalNode from "./components/nodes/ModalNode.svelte";
    import CustomNode from "./components/nodes/CustomNode.svelte";
    import ResultNode from "./components/nodes/ResultNode.svelte";
    import { initialNodes, initialEdges } from "./components/edges_and_nodes";
    import NodeModal from "./components/nodes/NodeModal.svelte";
    import CustomEdge from "./components/edges/CustomEdge.svelte";

    // Initialize SvelteFlow hook
    const { screenToFlowPosition, getEdges, getNodes } = useSvelteFlow();
    const nodes = writable<Node[]>(initialNodes);
    const edges = writable<Edge[]>(initialEdges);

    // Specify node types
    const nodeTypes: NodeTypes = {
        config: NodeModal,
        modal: ModalNode,
        custom: CustomNode,
        result: ResultNode,
    };

    const edgeTypes = {
        customEdge: CustomEdge,
    };

    // Listen for edge updates and ensure all have type "customEdge"
    edges.subscribe((updatedEdges) => {
        updatedEdges.forEach((edge) => {
            if (edge.type !== "customEdge") {
                edges.update((e) => e.map((e) => (e.id === edge.id ? { ...e, type: "customEdge" } : e)));
            }
        });
    });

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

        nodes.update((n) => [...n, newNode]);
    };

    let modalNodeId = 1;

    // Edge click handler
    const onEdgeClick = (
        event: CustomEvent<{ edge: Edge; event: MouseEvent | TouchEvent }>,
    ) => {
        const edge = event.detail.edge;

        const nodesAux: Node[] = getNodes();

        const sourceNode = nodesAux.find((node) => node.id === edge.source);
        const targetNode = nodesAux.find((node) => node.id === edge.target);

        // Find the handle that matches the edge
        const handle = sourceNode.data.handles.find(
            (h) => h.id === edge.sourceHandle,
        );

        function defineHandleEnd() {
            if (targetNode.data.handles === undefined) {
                return;
            } else {
                const handleEnd = targetNode.data.handles.find(
                    (h) => h.id === edge.targetHandle,
                );
                return handleEnd;
            }
        }
        const handleEnd = defineHandleEnd();

        const method = handle ? handle.edge : "";

        const methodEnd = handleEnd ? handleEnd.edge : "";

        // Create the new modal node
        const newNode: Node = {
            id: `${modalNodeId++}`,
            type: "modal",
            data: {
                text: sourceNode.data.text,
                methods: [method], // Pass the specific method
                methodsEnd: [methodEnd],
            },
            position: {
                x: (sourceNode.position.x + targetNode.position.x) / 2,
                y: (sourceNode.position.y + targetNode.position.y) / 2,
            },
        };

        nodes.update((n) => [...n, newNode]);

        // Remove the original edge
        edges.update((e) => e.filter((edgeItem) => edgeItem.id !== edge.id));

        // Create new edges
        const newEdges: Edge[] = [
            {
                id: `edge-${Math.random()}`,
                source: edge.source,
                target: newNode.id,
                sourceHandle: edge.sourceHandle,
            },
            {
                id: `edge-${Math.random()}`,
                source: newNode.id,
                target: edge.target,
                targetHandle: edge.targetHandle,
            },
        ];

        edges.update((e) => [...e, ...newEdges]);
    };

    // Node click handler
    export const createNodeModal = (event: CustomEvent<{ node: Node}>) => {
        const nodeId = event.detail.node.id;
        const nodesAux: Node[] = getNodes();
        const sourceNode = nodesAux.find((node) => node.id === nodeId);
        if (sourceNode.type === "config" || sourceNode.type === "modal") return;
        if (!sourceNode) return;

        const newNode: Node = {
            id: `${modalNodeId++}`,
            type: "config",
            data: {
                text: "",
                methods: sourceNode.data.handles.map((h) => h.edge),
            },
            position: {
                x: sourceNode.position.x + 50,
                y: sourceNode.position.y + 50,
            },
        };

        nodes.update((n) => [...n, newNode]);
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
        on:nodeclick={(e) => createNodeModal(e)}
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
