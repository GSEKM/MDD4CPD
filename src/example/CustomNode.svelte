<script lang="ts">
  import {
    Position,
    type NodeProps,
    useSvelteFlow,
    Handle,
  } from "@xyflow/svelte";

  import HandleComponent from "./HandleComponent.svelte";
  type $$Props = NodeProps;

  export let id: $$Props["id"];
  export let data: $$Props["data"];

  data.text = "testing for uppercase";

  const { updateNodeData } = useSvelteFlow();

  const handles = [];
  let leftQuantity = 0;
  let rightQuantity = 0;

  // @ts-ignore
  data.outs.forEach((item) =>
    handles.push({
      edge: item,
      index: leftQuantity++,
      id: `out-${leftQuantity}`,
      position: Position.Left,
    }),
  );
</script>

<div class="custom">
  <div class="label">text</div>
  <div>
    <input
      value={data.name}
      on:input={(evt) => updateNodeData(id, { text: evt.currentTarget.value })}
    />
  </div>
  <Handle type="source" position={Position.Right} />

  {#each handles as handle (handle.id)}
    <HandleComponent handleInfo={handle} />
  {/each}
</div>

<style>
  .custom {
    background-color: #eee;
    padding: 10px;
    border-radius: 10px;
  }

  .label {
    font-size: 12px;
    margin-bottom: 5px;
  }
</style>
