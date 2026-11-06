<script lang="ts">
    import "@xyflow/svelte/dist/style.css";
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
    import { onMount, tick } from "svelte";
    //@ts-ignore
    import Sidebar from "./components/sidebar/Sidebar.svelte";
    import { palette } from "./libraries/store";
    import CommandPalette from "./components/CommandPalette.svelte";
    import ImportReport from "./components/ImportReport.svelte";
    import { importSketch, type SketchImport } from "./importer/ino";
    import { evaluateEdit, type EditStatus } from "./importer/sync";
    import { importLibrariesFor } from "./libraries/store";
    //@ts-ignore
    import CustomNode from "./components/nodes/CustomNode.svelte";
    import Toolbar from "./components/Toolbar.svelte";
    import { edges, generation, hoveredStatement, nodes, problems } from "./components/code/store";
    import FlowEdge from "./components/edges/FlowEdge.svelte";
    import { tidyLayout } from "./components/layout";
    import { generateCode } from "./generator/generate";
    import { examples, type Diagram } from "./components/examples";
    import { categoryOf } from "./components/categories";
    import CodeViewer from "./components/codeViewer/codeViewer.svelte";

    const { screenToFlowPosition, fitView } = useSvelteFlow();

    const nodeTypes: NodeTypes = { custom: CustomNode };
    // Every link uses FlowEdge (also links saved before it existed).
    const edgeTypes = { default: FlowEdge };

    // #region Drag and drop from the palette
    const onDragOver = (event: DragEvent) => {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    };

    let canvasEl: HTMLDivElement;

    /** Adds a palette block at a screen position (default: canvas centre). */
    function addBlock(def: any, screen?: { x: number; y: number }) {
        const nodeData = JSON.parse(JSON.stringify(def));
        // Defaults of the original tool (MyEditableNodeModel)
        if (nodeData.extras && nodeData.extras.type !== "controller") {
            nodeData.extras.returnType = nodeData.extras.returnType || "byte";
            if (nodeData.extras.hasValue && nodeData.extras.value === undefined)
                nodeData.extras.value = "";
        }
        if (!screen) {
            const r = canvasEl.getBoundingClientRect();
            screen = { x: r.left + r.width / 2, y: r.top + r.height / 3 };
        }
        const newNode: Node = {
            id: `${Math.random()}`,
            type: "custom",
            position: screenToFlowPosition(screen),
            origin: [0.5, 0.0],
            data: nodeData,
        };
        nodes.update((n) => [...n.map((x) => ({ ...x, selected: false })), { ...newNode, selected: true }]);
    }

    const onDrop = (event: DragEvent) => {
        if (!event.dataTransfer) return;
        const file = event.dataTransfer.files?.[0];
        if (file) {
            event.preventDefault();
            open(file);
            return;
        }
        const data = event.dataTransfer.getData("application/svelteflow");
        if (!data) return; // not dragged from the palette
        addBlock(JSON.parse(data), { x: event.clientX, y: event.clientY });
    };

    // Command palette (Ctrl+K / Cmd+K)
    let paletteMode: "all" | "libraries" | null = null;
    function onKeydown(e: KeyboardEvent) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            paletteMode = paletteMode ? null : "all";
        }
    }
    // #endregion

    // Code is regenerated on every diagram change, as in the original tool.
    $: result =
        $nodes.length === 0
            ? { code: "", problems: [], statements: [] }
            : generateCode({ nodes: $nodes, edges: $edges });
    $: problems.set(result.problems);
    $: generation.set(result);
    $: controller = $nodes.find((n: any) => n.data?.extras?.type === "controller");

    // #region Diagram persistence (browser storage) and files
    const STORAGE_KEY = "mdd4cpd:diagram";

    function serialize(): Diagram {
        return {
            nodes: $nodes.map((n: any) => ({
                id: n.id,
                type: n.type,
                position: n.position,
                origin: n.origin,
                data: n.data,
            })),
            edges: $edges.map((e: any) => ({
                id: e.id,
                source: e.source,
                sourceHandle: e.sourceHandle,
                target: e.target,
                targetHandle: e.targetHandle,
            })),
        };
    }

    async function load(diagram: Diagram) {
        nodes.set(diagram.nodes || []);
        edges.set(diagram.edges || []);
        await tick();
        setTimeout(() => fitView({ padding: 0.15, duration: 300, maxZoom: 1 }), 50);
    }

    let restored = false;
    onMount(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved) load(JSON.parse(saved));
        } catch {
            /* storage unavailable or corrupt: start empty */
        }
        restored = true;
    });

    $: if (restored) {
        $nodes, $edges;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize()));
        } catch {
            /* storage unavailable */
        }
    }

    function confirmReplace() {
        return $nodes.length === 0 || confirm("Replace the current diagram?");
    }

    function loadExample(i: number) {
        if (confirmReplace()) load(examples[i].build());
    }

    function save() {
        const blob = new Blob([JSON.stringify(serialize(), null, 2)], {
            type: "application/json",
        });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${fileName}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
    }

    async function open(file: File) {
        if (/\.(ino|cpp|c|h)$/i.test(file.name)) return openSketch(file.name, await file.text());
        try {
            const diagram = JSON.parse(await file.text());
            if (!Array.isArray(diagram.nodes)) throw new Error("no nodes");
            if (confirmReplace()) load(diagram);
        } catch {
            alert("This file is neither an MDD4CPD diagram (.json) nor an Arduino sketch (.ino).");
        }
    }

    // #region Sketch (.ino) import
    let sketch: { name: string; text: string; result: SketchImport } | null = null;

    async function openSketch(name: string, text: string, replace = true) {
        const result = importSketch(text, $palette);
        if (replace && !confirmReplace()) return;
        await load(result.diagram);
        // re-arrange once the blocks have been measured
        setTimeout(tidy, 120);
        sketch = { name, text, result };
    }

    function retrySketch() {
        if (sketch) openSketch(sketch.name, sketch.text, false);
    }
    // #endregion

    // #region Code editing: the canvas follows the code
    let editSnapshot: Diagram | null = null;

    /** Applies edited code to the canvas, keeping the blocks it still describes. */
    function applyCode(text: string, force: boolean): EditStatus {
        const out = evaluateEdit(text, { nodes: $nodes as any, edges: $edges }, $palette);
        if (out.kind === "unchanged") return { kind: "unchanged", code: result.code };
        if (out.kind === "blocked" && !force)
            return { kind: "blocked", reasons: out.reasons, missing: out.result.missingIncludes };
        const first = $nodes.length === 0;
        nodes.set(out.merge.diagram.nodes as any);
        edges.set(out.merge.diagram.edges as any);
        if (first) setTimeout(tidy, 120);
        return {
            kind: "applied",
            code: out.code,
            added: out.merge.added,
            removed: out.merge.removed,
            skipped: out.kind === "blocked" ? out.reasons : [],
        };
    }

    function revertEdit() {
        if (editSnapshot) load(editSnapshot);
    }
    // #endregion

    function clear() {
        if (confirm("Remove every block from the canvas?")) {
            nodes.set([]);
            edges.set([]);
        }
    }

    $: fileName = (controller?.data?.name || "sketch").toString().toLowerCase().replace(/\W+/g, "_");
    // #endregion

    /** Deterministic layered layout (see components/layout.ts). */
    function tidy() {
        const positions = tidyLayout($nodes as any, $edges, result.statements);
        nodes.update((ns) =>
            ns.map((n: any) => {
                const p = positions.get(n.id);
                if (!p) return n;
                const w = n.computed?.width ?? 0;
                const h = n.computed?.height ?? 0;
                const [ox, oy] = n.origin ?? [0, 0];
                return { ...n, position: { x: p.x + ox * w, y: p.y + oy * h } };
            }),
        );
        setTimeout(() => fitView({ padding: 0.12, duration: 400, maxZoom: 1 }), 30);
    }

    /** Zooms to a node and selects it (used by the problems list). */
    function focusNode(id: string) {
        nodes.update((ns) => ns.map((n) => ({ ...n, selected: n.id === id })));
        fitView({ nodes: [{ id }], duration: 400, maxZoom: 1.2, padding: 0.8 });
    }

    // #region Resizable code panel
    let panelWidth = 440;
    let resizing = false;
    function startResize(e: PointerEvent) {
        resizing = true;
        const startX = e.clientX;
        const startWidth = panelWidth;
        const move = (ev: PointerEvent) => {
            panelWidth = Math.min(
                Math.max(300, startWidth - (ev.clientX - startX)),
                window.innerWidth * 0.6,
            );
        };
        const up = () => {
            resizing = false;
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
    }
    // #endregion

    const minimapColor = (n: any) => categoryOf(n.data?.extras?.type).color;
</script>

<svelte:window on:keydown={onKeydown} />

<div class="app" class:resizing>
    <Toolbar
        nodeCount={$nodes.length}
        edgeCount={$edges.length}
        problemCount={result.problems.length}
        controllerName={controller?.data?.name}
        on:example={(e) => loadExample(e.detail)}
        on:open={(e) => open(e.detail)}
        on:save={save}
        on:clear={clear}
        on:command={() => (paletteMode = "all")}
        on:tidy={tidy}
    />
    <div class="workspace">
        <Sidebar nodes={$palette} on:libraries={() => (paletteMode = "libraries")} />
        <div class="canvas" bind:this={canvasEl}>
            <SvelteFlow
                {nodes}
                {edges}
                {nodeTypes}
                {edgeTypes}
                colorMode="dark"
                deleteKey={["Backspace", "Delete"]}
                minZoom={0.2}
                on:dragover={onDragOver}
                on:drop={onDrop}
            >
                <Controls showLock={false} />
                <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} />
                <MiniMap pannable zoomable nodeColor={minimapColor} nodeStrokeWidth={0} />
            </SvelteFlow>

            {#if $nodes.length === 0}
                <div class="empty">
                    <div class="empty-card">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"
                            ><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect
                                x="14"
                                y="14"
                                width="7"
                                height="7"
                                rx="1.5"
                            /><path d="M10 6.5h4a2 2 0 0 1 2 2V14" /></svg
                        >
                        <h2>Build your device program</h2>
                        <ol>
                            <li>Drag a <b>micro-controller</b> from the palette</li>
                            <li>Add <b>values</b> and <b>functions</b></li>
                            <li>Link <code>setup()</code> / <code>loop()</code> through values into a function</li>
                        </ol>
                        <p>The Arduino code updates on the right as you build.</p>
                        <button class="ui-btn primary" on:click={() => loadExample(0)}
                            >Open the Blink example</button
                        >
                    </div>
                </div>
            {/if}
        </div>
        <div
            class="resizer"
            role="separator"
            aria-orientation="vertical"
            title="Drag to resize"
            on:pointerdown={startResize}
        ></div>
        <div class="code-panel" style="width: {panelWidth}px">
            <CodeViewer
                code={result.code}
                problems={result.problems}
                statements={result.statements}
                hovered={$hoveredStatement}
                on:hover={(e) => hoveredStatement.set(e.detail)}
                {fileName}
                {applyCode}
                importLibraries={importLibrariesFor}
                on:startEdit={() => (editSnapshot = serialize())}
                on:stopEdit={() => (editSnapshot = null)}
                on:revert={revertEdit}
                on:focus={(e) => focusNode(e.detail)}
            />
        </div>
    </div>
</div>

{#if sketch}
    <ImportReport
        fileName={sketch.name}
        result={sketch.result}
        on:close={() => (sketch = null)}
        on:retry={retrySketch}
    />
{/if}

{#if paletteMode}
    <CommandPalette
        initialMode={paletteMode}
        on:add={(e) => addBlock(e.detail)}
        on:close={() => (paletteMode = null)}
    />
{/if}

<style>
    .app {
        height: 100vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }
    .app.resizing {
        cursor: col-resize;
        user-select: none;
    }
    .workspace {
        flex: 1;
        display: flex;
        min-height: 0;
    }
    .canvas {
        position: relative;
        flex: 1;
        min-width: 0;
    }
    .resizer {
        width: 5px;
        margin: 0 -2px;
        z-index: 5;
        cursor: col-resize;
        position: relative;
    }
    .resizer::after {
        content: "";
        position: absolute;
        inset: 0 2px;
        background: var(--border);
        transition: background 0.12s;
    }
    .resizer:hover::after,
    .resizing .resizer::after {
        background: var(--accent);
    }
    .code-panel {
        flex-shrink: 0;
        min-width: 0;
    }

    .empty {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
    }
    .empty-card {
        pointer-events: auto;
        max-width: 360px;
        padding: 28px 30px;
        border: 1px dashed var(--border-strong);
        border-radius: 12px;
        background: #161920cc;
        backdrop-filter: blur(4px);
        text-align: center;
        color: var(--text-2);
    }
    .empty-card svg {
        width: 34px;
        height: 34px;
        margin: 0 auto 10px;
        color: var(--accent);
    }
    .empty-card h2 {
        color: var(--text);
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 12px;
    }
    .empty-card ol {
        text-align: left;
        list-style: decimal;
        padding-left: 20px;
        margin-bottom: 12px;
        line-height: 1.7;
    }
    .empty-card b {
        color: var(--text);
        font-weight: 600;
    }
    .empty-card code {
        font-family: var(--mono);
        font-size: 12px;
        color: var(--cat-controller);
    }
    .empty-card p {
        font-size: 12px;
        color: var(--text-3);
        margin-bottom: 16px;
    }
</style>
