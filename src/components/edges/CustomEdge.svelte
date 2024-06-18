<script lang="ts">
    import { type EdgeProps, getBezierPath, BaseEdge, EdgeLabelRenderer } from '@xyflow/svelte';
  
    type $$Props = EdgeProps;
  
    export let sourceX: $$Props['sourceX'];
    export let sourceY: $$Props['sourceY'];
    export let sourcePosition: $$Props['sourcePosition'];
    export let targetX: $$Props['targetX'];
    export let targetY: $$Props['targetY'];
    export let targetPosition: $$Props['targetPosition'];
    export let data: $$Props['data'] = undefined;
  
    $: [edgePath, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition
    });
  </script>
  
  <BaseEdge path={edgePath} />
  <EdgeLabelRenderer>
    <div 
      style:transform="translate(-50%, -50%) translate({labelX}px,{labelY}px)"
      class="edge-label"
    >
      {data.label}
  </div>
  </EdgeLabelRenderer>
  
  <style>
  </style>