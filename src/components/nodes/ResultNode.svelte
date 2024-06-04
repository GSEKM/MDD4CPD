<script lang="ts">
  import {
    Handle,
    Position,
    useHandleConnections,
    useNodesData,
    type NodeProps,
  } from "@xyflow/svelte";

  type $$Props = NodeProps;

  export let id: $$Props["id"];

  const connections = useHandleConnections({
    nodeId: id,
    type: "target",
  });

  $: nodesData = useNodesData(
    $connections.map((connection) => connection.source),
  );
</script>

<div class="custom">
  <Handle type="target" position={Position.Left} />
  <div class="label">Generated Arduino Code:</div>

  {#if $nodesData === undefined || $nodesData.length === 0}
    <div>No connected nodes</div>
  {:else}
    {#each $nodesData as nodeData}
      <div><pre>{nodeData.data.generatedCode}</pre></div>
    {/each}
  {/if}
</div>

<style>
  .custom {
    background-color: #eee;
    padding: 10px;
    border-radius: 10px;
    font-size: 12px;
  }

  .label {
    margin-bottom: 5px;
  }

  pre {
    background-color: #f8f8f8;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 5px;
    white-space: pre-wrap;
  }
</style>
