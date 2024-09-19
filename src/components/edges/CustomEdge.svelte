<script lang="ts">
  import {
    type EdgeProps,
    getBezierPath,
    BaseEdge,
    EdgeLabelRenderer,
  } from "@xyflow/svelte";

  type $$Props = EdgeProps;

  export let sourceX: $$Props["sourceX"];
  export let sourceY: $$Props["sourceY"];
  export let sourcePosition: $$Props["sourcePosition"];
  export let targetX: $$Props["targetX"];
  export let targetY: $$Props["targetY"];
  export let targetPosition: $$Props["targetPosition"];
  export let data: $$Props["data"] = {
    label: "test",

  };

  $: [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
</script>

<BaseEdge path={edgePath} />
<EdgeLabelRenderer>
  <div
    style:transform="translate(-50%, -50%) translate({labelX}px,{labelY}px)"
    class="edge-label nodrag nopan"
  >
    <button class="close-button" >
      <i class="fas fa-cog"></i>
    </button>
  </div>
</EdgeLabelRenderer>

<style>
  .edge-label {
    position: absolute;
  }
  .close-button {
    width: 12px;
    height: 12px;
    background-color: red; 
    border-radius: 50%; 
    color: white; 
    font-size: 8px;
    cursor: pointer; 
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2); 
    transition: background-color 0.3s; 
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .close-button:hover {
    background-color: #a19d9d; 
  }

  .close-button:focus {
    outline: none; 
  }
</style>
