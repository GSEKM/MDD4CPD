<script lang="ts">
  import {
    Handle,
    Position,
    type NodeProps,
    useSvelteFlow,
    useUpdateNodeInternals,
  } from "@xyflow/svelte";
  import { edges } from "../code/store";

  type $$Props = NodeProps;
  export let id: $$Props["id"];
  export let data: $$Props["data"];
  // Svelte Flow passes more props than we use; referencing $$restProps
  // silences the dev-mode "unknown prop" warnings.
  $$restProps;

  const { updateNodeData } = useSvelteFlow();
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
  const paramTypes = [
    "variable",
    "constant",
    "parameter",
    "port",
    "built-in-constant",
  ];

  interface HandleInfo {
    id: string;
    edge: string;
    index: number;
    type: "source" | "target";
    position: Position;
    isConnectable: boolean;
  }

  function addHandle(
    handles: HandleInfo[],
    edge: string,
    index: number,
    type: "source" | "target",
  ) {
    handles.push({
      id: `${type}-${index}`,
      edge,
      index,
      type,
      position: type === "source" ? Position.Right : Position.Left,
      isConnectable: true,
    });
  }

  function createHandles(d: any): HandleInfo[] {
    const handles: HandleInfo[] = [];
    let leftIndex = 0;
    let rightIndex = 0;
    d.outs?.forEach((e: string) => addHandle(handles, e, rightIndex++, "source"));
    d.ins?.forEach((e: string) => addHandle(handles, e, leftIndex++, "target"));
    d.methods?.forEach((e: string) => {
      addHandle(handles, e, rightIndex++, "source");
      addHandle(handles, e, leftIndex++, "target");
    });
    return handles;
  }

  // Handles live in the node data so that the generator can read them.
  if (!data.handles) updateNodeData(id, { handles: createHandles(data) });

  $: extras = data.extras || {};
  $: handles = (data.handles || []) as HandleInfo[];
  $: isValueNode = paramTypes.includes(extras.type);

  // One row per index: in-k on the left, out-k on the right.
  $: rows = Array.from(
    { length: Math.max(0, ...handles.map((h) => h.index + 1)) },
    (_, i) => ({
      left: handles.find((h) => h.type === "target" && h.index === i),
      right: handles.find((h) => h.type === "source" && h.index === i),
    }),
  );

  function setExtra(key: string, value: string) {
    if (key === "value" && data.name === "Function") value = value.replace(/\s/g, "");
    updateNodeData(id, { extras: { ...extras, [key]: value } });
  }

  // #region Usages (extra in/out pairs), as in the original tool
  $: firstUsage = data.name === "Function" ? 1 : 0;
  $: usageBase = rows[firstUsage];

  function nextIndex() {
    return Math.max(-1, ...handles.map((h) => h.index)) + 1;
  }

  function setHandles(next: HandleInfo[]) {
    updateNodeData(id, { handles: next });
    // Svelte Flow must re-measure the handles after they change.
    setTimeout(() => updateNodeInternals(id), 0);
  }

  function addPair(leftName?: string, rightName?: string) {
    const next = [...handles];
    const index = nextIndex();
    if (rightName) addHandle(next, rightName, index, "source");
    if (leftName) addHandle(next, leftName, index, "target");
    setHandles(next);
  }

  function addUsage() {
    const count = handles.filter(
      (h) => h.type === "target" && h.edge.startsWith(usageBase?.left?.edge),
    ).length;
    addPair(
      usageBase?.left && `${usageBase.left.edge}-${count}`,
      usageBase?.right && `${usageBase.right.edge}-${count}`,
    );
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
  // #endregion
</script>

<div class="custom" style={`border-color: ${data.color};`}>
  <div class="label">{data.name}</div>

  <div class="editors nodrag">
    {#if extras.hasReturnType}
      <label>
        type
        <select
          value={extras.returnType}
          on:change={(e) => setExtra("returnType", e.currentTarget.value)}
        >
          {#each returnTypes as t}<option value={t}>{t}</option>{/each}
        </select>
      </label>
    {/if}
    {#if extras.hasPortType}
      <label>
        port
        <select
          value={extras.portType}
          on:change={(e) => setExtra("portType", e.currentTarget.value)}
        >
          {#each portTypes as t}<option value={t}>{t}</option>{/each}
        </select>
      </label>
    {/if}
    {#if extras.hasUsername}
      <label>
        name
        <input
          value={extras.name ?? ""}
          on:input={(e) => setExtra("name", e.currentTarget.value)}
        />
      </label>
    {/if}
    {#if extras.hasValue}
      <label>
        {data.name === "Function"
          ? "name"
          : extras.type === "logic"
            ? "operator"
            : "value"}
        {#if extras.selectableOptions || extras.returnType === "bool"}
          <select
            value={extras.value}
            on:change={(e) => setExtra("value", e.currentTarget.value)}
          >
            {#each extras.returnType === "bool" ? ["true", "false"] : extras.selectableOptions as o}
              <option value={o}>{o}</option>
            {/each}
          </select>
        {:else if extras.type === "logic" && data.name !== "Function"}
          <select
            value={extras.value}
            on:change={(e) => setExtra("value", e.currentTarget.value)}
          >
            {#each operators as o}<option value={o}>{o}</option>{/each}
          </select>
        {:else}
          <input
            value={extras.value ?? ""}
            placeholder={isValueNode ? "1,2,3 for arrays" : ""}
            on:input={(e) => setExtra("value", e.currentTarget.value)}
          />
        {/if}
      </label>
    {/if}
    {#if extras.hasUsages}
      <div class="usages">
        usages
        <button on:click={addUsage} title="Add usage">+</button>
        <button
          on:click={() => removeLast(usageBase?.left?.edge ?? "", firstUsage)}
          title="Remove last unconnected usage">-</button
        >
      </div>
    {/if}
    {#if extras.type === "variable"}
      <div class="usages">
        setters
        <button on:click={() => addPair(setter, setter)} title="Add setter"
          >+</button
        >
        <button on:click={() => removeLast("void setValue", 0)} title="Remove last unconnected setter"
          >-</button
        >
      </div>
    {/if}
  </div>

  {#each rows as row}
    <div class="row">
      {#if row.left}
        <Handle
          type="target"
          position={Position.Left}
          id={row.left.id}
          class="port"
        />
      {/if}
      <span class="in">{row.left?.edge ?? ""}</span>
      {#if row.right && row.right.edge !== row.left?.edge}
        <span class="out">{row.right.edge}</span>
      {/if}
      {#if row.right}
        <Handle
          type="source"
          position={Position.Right}
          id={row.right.id}
          class="port"
        />
      {/if}
    </div>
  {/each}
</div>

<style>
  .custom {
    background-color: #2d2d2d;
    border-radius: 10px;
    border-width: 1px;
    border-style: solid;
    color: #fff;
    min-width: 80px;
    padding-bottom: 4px;
  }

  .label {
    font-size: 15px;
    font-weight: bold;
    margin: 8px 10px 4px 10px;
    text-align: center;
  }

  .editors {
    display: flex;
    flex-direction: column;
    gap: 3px;
    margin: 0 10px 4px 10px;
    font-size: 11px;
    color: #bbb;
  }

  .editors label,
  .usages {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
  }

  .editors input,
  .editors select {
    background: #1a1a1a;
    color: #fff;
    border: 1px solid #555;
    border-radius: 4px;
    font-size: 11px;
    padding: 1px 4px;
    width: 90px;
  }

  .usages button {
    background: #555;
    color: #fff;
    border-radius: 4px;
    width: 18px;
    line-height: 16px;
    margin-left: 2px;
  }

  .row {
    position: relative;
    display: flex;
    justify-content: space-between;
    gap: 16px;
    padding: 6px 12px;
    border-top: 1px solid #00000040;
    font-size: 13px;
    white-space: nowrap;
  }

  .out {
    margin-left: auto;
  }

  :global(.svelte-flow__handle.port) {
    background-color: #fff;
    border: 1px solid #000;
    width: 10px;
    height: 10px;
  }
</style>
