<script lang="ts">
    import { Position, Handle } from "@xyflow/svelte";
     
    export let handleInfo: Handle["handleInfo"];
   
    console.log("hi", handleInfo);
    

    const offset = 45 + handleInfo.index * 30 ;
</script>

<div id={handleInfo.id}>
    <p
        style={{
            position: "absolute",
            top: `${offset}px`,
            right: "20px",
            margin: 0,
            lineHeight: "20px",
        }}
    >
        {handleInfo.edge}
    </p>
    <!-- type={data.types} -->
    <Handle
        id={handleInfo.id}
        position={handleInfo.position}
        isConnectable={true}
        type="source"
        style={` top: ${offset}px;`}
    />
</div>
