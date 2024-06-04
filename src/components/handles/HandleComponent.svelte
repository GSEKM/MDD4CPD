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
    console.log("handle info: "+handleInfo.id )
    const offset = 45 + handleInfo.index * 30;
  </script>
  
  <div id={handleInfo.id}>
    <p style={`top: ${offset}px; right: 20px; margin: 0; line-height: 20px;`}>
      {handleInfo.edge}
    </p>
    <SvelteHandle
      id={handleInfo.id}
      position={handleInfo.position}
      isConnectable={handleInfo.isConnectable}
      type={handleInfo.type}
      style={`top: ${offset}px;`}
    />
  </div>
  