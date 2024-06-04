<script lang="ts">
  import {
    Position,
    type NodeProps,
    useSvelteFlow,
    Handle,
  } from "@xyflow/svelte";
  import HandleComponent from "../handles/HandleComponent.svelte";

  type $$Props = NodeProps;

  export let id: $$Props["id"];
  export let data: $$Props["data"];

  interface Extras {
    value?: string;
    group?: string;
    type?: string;
    hasUsages?: boolean;
    hasPortType?: boolean;
    portType?: string;
    returnType?: string;
    selectableOptions?: string[];
    hasValue?: boolean;
    analogPorts?: number;
    digitalPorts?: number;
  }

  interface Data {
    name?: string;
    color?: string;
    highlighted?: boolean;
    extras?: Extras;
    outs?: string[];
    ins?: string[];
    methods?: string[];
    handles?: Handle[];
  }

  const typedData = data as Data;

  const { updateNodeData } = useSvelteFlow();

  interface Handle {
    id: string;
    position: Position;
    type: "source" | "target";
    isConnectable: boolean;
    edge: string;
    index: number;
  }

  const handles: Handle[] = [];

if (typedData.outs) {
  let rightQuantity = 0;
  typedData.outs.forEach((item) => {
    handles.push({
      edge: item,
      index: rightQuantity++,
      id: `outs-${rightQuantity}`,
      position: Position.Right,
      type: 'source',
      isConnectable: true,
    });
  });
}

if (typedData.ins) {
  let leftQuantity = 0;
  typedData.ins.forEach((item) => {
    handles.push({
      edge: item,
      index: leftQuantity++,
      id: `ins-${leftQuantity}`,
      position: Position.Left,
      type: 'target',
      isConnectable: true,
    });
  });
}

if (typedData.methods) {
  let leftQuantity = 0;
  let rightQuantity = 0;

  typedData.methods.forEach((item) => {
    handles.push({
      edge: item,
      index: rightQuantity++,
      id: `outs-${rightQuantity}`,
      position: Position.Right,
      type: 'source',
      isConnectable: true,
    });
  });

  typedData.methods.forEach((item) => {
    handles.push({
      edge: item,
      index: leftQuantity++,
      id: `ins-${leftQuantity}`,
      position: Position.Left,
      type: 'target',
      isConnectable: true,
    });
  });
}

// Update the node data to include the handles
updateNodeData(id, {
  ...typedData,
  handles: handles
});

</script>

<div class="custom">
  <div class="label">{typedData.name}</div>

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
