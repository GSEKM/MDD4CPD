<script lang="ts">
  import {
    Handle,
    Position,
    type NodeProps,
    useSvelteFlow,
    useUpdateNodeInternals,
  } from "@xyflow/svelte";
  import { edges, hoveredStatement, problemsByNode, statementsByNode } from "../code/store";
  import { categoryOf } from "../categories";
  import {
    addHandle,
    createHandles,
    splitSignature,
    withUsage,
    type HandleInfo,
  } from "./handles";

  type $$Props = NodeProps;
  export let id: $$Props["id"];
  export let data: $$Props["data"];
  export let selected: boolean = false;
  // Svelte Flow passes more props than we use; referencing $$restProps
  // silences the dev-mode "unknown prop" warnings.
  $$restProps;

  const { updateNodeData, deleteElements } = useSvelteFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  // Same lists as the original tool (MyEditableNodeWidget)
  const returnTypes = [
    "byte",
    "uint8_t",
    "uint16_t",
    "int32_t",
    "unsigned int",
    "unsigned long",
    "int",
    "long",
    "bool",
    "float",
    "double",
    "char",
    "String",
  ];
  const portTypes = ["Digital", "Analog"];
  const operators = ["==", "!=", "<", ">", "<=", ">="];

  // Handles live in the node data so that the generator can read them.
  if (!data.handles) updateNodeData(id, { handles: createHandles(data) });

  $: extras = data.extras || {};
  $: cat = categoryOf(extras.type);
  $: handles = (data.handles || []) as HandleInfo[];
  $: nodeProblems = $problemsByNode.get(id) || [];
  $: lit = $hoveredStatement !== null && ($statementsByNode.get(id) || []).includes($hoveredStatement);
  $: dim = $hoveredStatement !== null && !lit;

  // One row per index: in-k on the left, out-k on the right.
  $: rows = Array.from(
    { length: Math.max(0, ...handles.map((h) => h.index + 1)) },
    (_, i) => ({
      left: handles.find((h) => h.type === "target" && h.index === i),
      right: handles.find((h) => h.type === "source" && h.index === i),
    }),
  );

  // Long classes (imported libraries) show the first rows plus connected ones.
  const COLLAPSED_ROWS = 8;
  $: collapsible = rows.length > COLLAPSED_ROWS + 2;
  $: visibleRows =
    collapsible && !data.expanded
      ? rows.filter((r, i) => i < COLLAPSED_ROWS || isConnected(r.left) || isConnected(r.right))
      : rows;
  function toggleExpanded() {
    updateNodeData(id, { expanded: !data.expanded });
    setTimeout(() => updateNodeInternals(id), 0);
  }

  function setExtra(key: string, value: string) {
    if (key === "value" && data.name === "Function") value = value.replace(/\s/g, "");
    updateNodeData(id, { extras: { ...extras, [key]: value } });
  }

  function setHandles(next: HandleInfo[]) {
    updateNodeData(id, { handles: next });
    // Svelte Flow must re-measure the handles after they change.
    setTimeout(() => updateNodeInternals(id), 0);
  }

  function isConnected(h: HandleInfo | undefined) {
    if (!h) return false;
    return $edges.some(
      (e) =>
        (e.source === id && e.sourceHandle === h.id) ||
        (e.target === id && e.targetHandle === h.id),
    );
  }

  /** Removes the last added pair whose left label starts with `prefix`. */
  function removeLast(prefix: string, minRow: number) {
    for (let i = rows.length - 1; i > minRow; i--) {
      const row = rows[i];
      if (!row.left?.edge.startsWith(prefix)) continue;
      if (isConnected(row.left) || isConnected(row.right)) return;
      setHandles(handles.filter((h) => h !== row.left && h !== row.right));
      return;
    }
  }

  const setter = "void setValue(<T> value)";
  function addSetter() {
    const next = [...handles];
    const index = Math.max(-1, ...handles.map((h) => h.index)) + 1;
    addHandle(next, setter, index, "source");
    addHandle(next, setter, index, "target");
    setHandles(next);
  }

  $: firstUsage = data.name === "Function" ? 1 : 0;
  $: usagePrefix = rows[firstUsage]?.left?.edge ?? "";
  $: usageCount = rows.filter(
    (r, i) => i > firstUsage && r.left?.edge.startsWith(usagePrefix + "-"),
  ).length;
  $: hasEditors =
    extras.hasReturnType || extras.hasPortType || extras.hasUsername || extras.hasValue;
  $: valueLabel =
    data.name === "Function" ? "name" : extras.type === "logic" ? "operator" : "value";

  /** Usage handles are named "in-1"/"out-1"; show them as "in 2"/"out 2". */
  function pretty(label: string | undefined) {
    if (!label) return "";
    const m = label.match(/^(.*)-(\d+)$/);
    return m ? `${m[1]} ${Number(m[2]) + 1}` : label;
  }
</script>

<div
  class="node"
  class:selected
  class:has-problems={nodeProblems.length > 0}
  class:lit
  class:dim
  style="--cat: {cat.color}"
>
  <header>
    <span class="cat">{cat.label.replace(/s$/, "")}</span>
    <span class="title">{data.name}</span>
    {#if nodeProblems.length > 0}
      <span class="badge" title={nodeProblems.map((p) => p.message).join("\n")}
        >{nodeProblems.length}</span
      >
    {/if}
    <button
      class="delete nodrag"
      title="Delete block"
      on:click={() => deleteElements({ nodes: [{ id }] })}>×</button
    >
  </header>

  {#if hasEditors}
    <div class="editors nodrag">
      {#if extras.hasReturnType}
        <label>
          <span>type</span>
          <select
            class="ui-select"
            value={extras.returnType}
            on:change={(e) => setExtra("returnType", e.currentTarget.value)}
          >
            {#each returnTypes as t}<option value={t}>{t}</option>{/each}
          </select>
        </label>
      {/if}
      {#if extras.hasPortType}
        <label>
          <span>port</span>
          <select
            class="ui-select"
            value={extras.portType}
            on:change={(e) => setExtra("portType", e.currentTarget.value)}
          >
            {#each portTypes as t}<option value={t}>{t}</option>{/each}
          </select>
        </label>
      {/if}
      {#if extras.hasUsername}
        <label>
          <span>name</span>
          <input
            class="ui-input"
            value={extras.name ?? ""}
            on:input={(e) => setExtra("name", e.currentTarget.value)}
          />
        </label>
      {/if}
      {#if extras.hasValue}
        <label>
          <span>{valueLabel}</span>
          {#if extras.selectableOptions || extras.returnType === "bool"}
            <select
              class="ui-select"
              value={extras.value}
              on:change={(e) => setExtra("value", e.currentTarget.value)}
            >
              {#each extras.returnType === "bool" ? ["true", "false"] : extras.selectableOptions as o}
                <option value={o}>{o}</option>
              {/each}
            </select>
          {:else if extras.type === "logic" && data.name !== "Function"}
            <select
              class="ui-select"
              value={extras.value}
              on:change={(e) => setExtra("value", e.currentTarget.value)}
            >
              {#each operators as o}<option value={o}>{o}</option>{/each}
            </select>
          {:else}
            <input
              class="ui-input"
              value={extras.value ?? ""}
              placeholder={extras.type === "logic" ? "" : "e.g. 10 or 1,2,3"}
              on:input={(e) => setExtra("value", e.currentTarget.value)}
            />
          {/if}
        </label>
      {/if}
    </div>
  {/if}

  <div class="rows">
    {#each visibleRows as row (row.left?.id ?? row.right?.id)}
      {@const sig = splitSignature(row.left?.edge ?? row.right?.edge ?? "")}
      {@const same = row.left && row.right && row.left.edge === row.right.edge}
      <div class="row" class:method={same && sig}>
        {#if row.left}
          <Handle type="target" position={Position.Left} id={row.left.id} class="port" />
        {/if}
        {#if same && sig}
          <span class="sig" title={row.left?.edge}>
            <span class="fn">{sig.name}</span><span class="args">({sig.args})</span>
          </span>
          {#if sig.ret && sig.ret !== "void"}<span class="ret">{sig.ret}</span>{/if}
        {:else if same}
          <span class="in">{row.left?.edge.replace(/^void /, "")}</span>
        {:else}
          <span class="in">{pretty(row.left?.edge)}</span>
          {#if row.right}<span class="out">{pretty(row.right.edge)}</span>{/if}
        {/if}
        {#if row.right}
          <Handle type="source" position={Position.Right} id={row.right.id} class="port" />
        {/if}
      </div>
    {/each}
  </div>

  {#if collapsible}
    <button class="more nodrag" on:click={toggleExpanded}>
      {data.expanded ? "Show fewer" : `Show all ${rows.length} functions`}
    </button>
  {/if}

  {#if extras.hasUsages || extras.type === "variable"}
    <footer class="nodrag">
      {#if extras.hasUsages}
        <div class="stepper" title="Usages: reuse this block in more statements">
          <span>usages</span>
          <button
            on:click={() => removeLast(usagePrefix, firstUsage)}
            disabled={usageCount === 0}
            title="Remove the last unconnected usage">−</button
          >
          <b>{usageCount + 1}</b>
          <button on:click={() => setHandles(withUsage(data.name, handles))} title="Add a usage"
            >+</button
          >
        </div>
      {/if}
      {#if extras.type === "variable"}
        <button class="link-btn" on:click={addSetter} title="Add a setter (assignment) handle"
          >+ setter</button
        >
      {/if}
    </footer>
  {/if}
</div>

<style>
  .node {
    min-width: 150px;
    max-width: 320px;
    background: var(--panel-2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
    box-shadow: 0 6px 18px #00000055;
    font-size: 12px;
    transition: border-color 0.12s, box-shadow 0.12s, opacity 0.12s;
  }
  .node.selected {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent), 0 8px 24px #00000066;
  }
  .node.has-problems {
    border-color: var(--warn);
  }
  .node.lit {
    border-color: var(--cat);
    box-shadow: 0 0 0 1px var(--cat), 0 8px 24px #00000066;
  }
  .node.dim {
    opacity: 0.45;
  }

  header {
    position: relative;
    display: grid;
    grid-template-columns: 1fr auto auto;
    grid-template-rows: auto auto;
    column-gap: 6px;
    align-items: center;
    padding: 7px 8px 7px 12px;
    border-bottom: 1px solid var(--border);
    background: linear-gradient(90deg, color-mix(in srgb, var(--cat) 16%, transparent), transparent 85%);
    border-radius: var(--radius) var(--radius) 0 0;
  }
  header::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: var(--cat);
    border-radius: var(--radius) 0 0 0;
  }
  .cat {
    grid-column: 1;
    font-size: 9.5px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--cat);
  }
  .title {
    grid-column: 1;
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
  }
  .badge {
    grid-column: 2;
    grid-row: 1 / 3;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: var(--warn);
    color: #1a1300;
    font-size: 11px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: help;
  }
  .delete {
    grid-column: 3;
    grid-row: 1 / 3;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    color: var(--text-3);
    font-size: 15px;
    line-height: 1;
    opacity: 0;
    transition: opacity 0.12s;
  }
  .node:hover .delete,
  .node.selected .delete {
    opacity: 1;
  }
  .delete:hover {
    background: var(--raised);
    color: var(--text);
  }

  .editors {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--border);
  }
  .editors label {
    display: grid;
    grid-template-columns: 52px 1fr;
    align-items: center;
    gap: 8px;
  }
  .editors label span {
    color: var(--text-3);
    font-size: 11px;
  }
  .editors .ui-input,
  .editors .ui-select {
    width: 100%;
    min-width: 0;
    height: 24px;
    padding: 1px 6px;
  }

  .rows {
    padding: 3px 0;
  }
  .row {
    position: relative;
    display: flex;
    align-items: center;
    gap: 14px;
    min-height: 26px;
    padding: 3px 14px;
    white-space: nowrap;
  }
  .row:hover {
    background: #ffffff06;
  }
  .in {
    color: var(--text-2);
  }
  .out {
    margin-left: auto;
    color: var(--text-2);
  }
  .sig {
    font-family: var(--mono);
    font-size: 11.5px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .fn {
    color: var(--text);
  }
  .args {
    color: var(--text-3);
  }
  .ret {
    margin-left: auto;
    padding: 0 5px;
    border-radius: 4px;
    background: var(--raised);
    color: var(--text-2);
    font-family: var(--mono);
    font-size: 10px;
  }

  .more {
    display: block;
    width: 100%;
    padding: 5px 12px 7px;
    border-top: 1px solid var(--border);
    color: var(--text-3);
    font-size: 11px;
    text-align: left;
  }
  .more:hover {
    color: var(--accent);
  }

  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 6px 10px;
    border-top: 1px solid var(--border);
    color: var(--text-3);
    font-size: 11px;
  }
  .stepper {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .stepper span {
    margin-right: 2px;
  }
  .stepper b {
    color: var(--text);
    min-width: 10px;
    text-align: center;
  }
  .stepper button,
  .link-btn {
    height: 20px;
    min-width: 20px;
    padding: 0 5px;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: var(--panel);
    color: var(--text-2);
    line-height: 1;
  }
  .stepper button:hover:not(:disabled),
  .link-btn:hover {
    color: var(--text);
    border-color: var(--border-strong);
  }
  .stepper button:disabled {
    opacity: 0.35;
  }

  :global(.svelte-flow__handle.port) {
    width: 9px;
    height: 9px;
    background: var(--panel-2);
    border: 2px solid var(--cat, var(--text-2));
    transition: transform 0.1s, background 0.1s;
  }
  :global(.svelte-flow__handle.port:hover),
  :global(.svelte-flow__handle.port.connectingto) {
    transform: translate(var(--tx, 0), -50%) scale(1.35);
    background: var(--cat, var(--text));
  }
  :global(.svelte-flow__handle-left.port) {
    --tx: -50%;
  }
  :global(.svelte-flow__handle-right.port) {
    --tx: 50%;
  }
</style>
