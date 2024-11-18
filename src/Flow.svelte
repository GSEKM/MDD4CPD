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
    //@ts-ignore
    import Sidebar from "./components/sidebar/Sidebar.svelte";
    import paletteNodes from "./nodes.json";
    import ModalNode from "./components/nodes/ModalNode.svelte";
    //@ts-ignore
    import CustomNode from "./components/nodes/CustomNode.svelte";
    //@ts-ignore
    import ResultNode from "./components/nodes/ResultNode.svelte";
    //@ts-ignore
    import NodeModal from "./components/nodes/NodeModal.svelte";
    //@ts-ignore
    import CustomEdge from "./components/edges/CustomEdge.svelte";
    import { edges, nodes } from "./components/code/store";
    import generateCode from "./components/code/code";
    import Code from "./components/code/code";
    import CodeViewer from "./components/codeViewer/codeViewer.svelte";
    // Initialize SvelteFlow hook
    const { screenToFlowPosition, getNodes, updateNode, toObject } =
        useSvelteFlow();

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
        //@ts-ignore
        const handle = sourceNode?.data?.handles.find(
            (h) => h.id === edge.sourceHandle,
        );
        console.log("sourceNode.handles", sourceNode.data.handles);
        console.log("handle", handle);
        console.log("edge.data", edge.data);
        function defineHandleEnd() {
            if (targetNode.data.handles === undefined) {
                return;
            } else {
                //@ts-ignore
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

        const newData = {
            ...edge?.data,
            text: sourceNode.data.text,
            methods: [method], // Pass the specific method
            methodsEnd: [methodEnd],
        };

        console.log("Criando newNode", newData);

        const newNode: Node = {
            id: `${modalNodeId++}`,
            type: "modal",
            data: newData,
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
                id: `${edge.id}-left`,
                source: edge.source,
                target: newNode.id,
                sourceHandle: edge.sourceHandle,
            },
            {
                id: `${edge.id}-right`,
                source: newNode.id,
                target: edge.target,
                targetHandle: edge.targetHandle,
            },
        ];

        edges.update((e) => [...e, ...newEdges]);
        // Update the source node position to the exact same place
        updateNode(edge.source, { position: sourceNode.position });
    };

    // Node click handler
    export const createNodeModal = (event: CustomEvent<{ node: Node }>) => {
        const nodeId = event.detail.node.id;
        const nodesAux: Node[] = getNodes();
        const sourceNode = nodesAux.find((node) => node.id === nodeId);
        if (sourceNode.type === "config" || sourceNode.type === "modal") return;
        if (!sourceNode) return;

        const newNode: Node = {
            id: `${modalNodeId++}`,
            type: "config",
            data: {
                //@ts-ignore
                inputParameterName:
                    //@ts-ignore
                    sourceNode.data.extras?.inputParameterName || "",
                //@ts-ignore
                methods: sourceNode.data.handles.map((h) => h.edge),
                source: sourceNode.id,
                // extra: {
                // },
            },
            position: {
                x: sourceNode.position.x - 130,
                y: sourceNode.position.y - 290,
            },
        };

        nodes.update((n) => [...n, newNode]);
    };

    export function getRepresentation() {
        const representation = toObject();
        return { model: JSON.stringify(representation) };
    }

    // Stores reativas para `code` e `problems`
    export const code = writable("");
    export const problems = writable([]);

    const onSaveClick = () => {
        const result = generateCode(getRepresentation());
        if (result) {
            code.set(result.code);
            problems.set(result.problems);
        }
    };
</script>

<main>
    <Sidebar nodes={paletteNodes} />
    <SvelteFlow
        {nodes}
        {edges}
        {nodeTypes}
        {edgeTypes}
        defaultEdgeOptions={{ type: "customEdge" }}
        on:dragover={onDragOver}
        on:drop={onDrop}
        on:edgeclick={onEdgeClick}
        on:nodeclick={(e) => createNodeModal(e)}
    >
        <Controls />
        <Background variant={BackgroundVariant.Dots} />

        <MiniMap pannable zoomable />
    </SvelteFlow>
    <button class="save-button" on:click={onSaveClick}>Salvar</button>
    <CodeViewer code={$code} problems={$problems} />
</main>

<style>
    main {
        height: 100vh;
        display: flex;
    }
</style>
