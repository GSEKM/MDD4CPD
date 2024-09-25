<script lang="ts">
  import { Position, Handle as SvelteHandle } from "@xyflow/svelte";
  export let handleInfo: {
    id: string;
    position: Position;
    type: "source" | "target";
    isConnectable: boolean;
    edge: string;
    index: number;
  };
</script>

<div id={handleInfo.id} class="container">
  <p>{handleInfo.edge}</p>
  <SvelteHandle
    class="handle {handleInfo.edge === 'left'
      ? 'handle-left'
      : handleInfo.edge === 'right'
        ? 'handle-right'
        : handleInfo.edge === 'top'
          ? 'handle-top'
          : 'handle-bottom'}"
    id={handleInfo.id}
    position={handleInfo.position}
    isConnectable={handleInfo.isConnectable}
    type={handleInfo.type}
    style="background-color: #fff; border: 1px solid #000; border-radius: 50%; width: 10px; height: 10px;"
  />
</div>

<style>
  .container {
    position: relative;
    padding: 10px;
    border: 1px solid #00000017;
  }
  .handle {
    position: absolute;
  }
</style>
