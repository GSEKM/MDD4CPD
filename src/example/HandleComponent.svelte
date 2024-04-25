<script lang="ts">
    import { Position, Handle } from "@xyflow/svelte";

    export let handleInfo: $$Props["handleInfo"];

    console.log("hi", handleInfo);

    const offset = 50 + handleInfo.index * 50;
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
        style={`position: "absolute" ; top: ${offset}px`}
    />
</div>
