<script lang="ts">
  import {  Position, type NodeProps, useSvelteFlow, type Node } from "@xyflow/svelte";
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

  const {updateNodeData} = useSvelteFlow();

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
        type: "source",
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
        type: "target",
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
        type: "source",
        isConnectable: true,
      });
    });

    typedData.methods.forEach((item) => {
      handles.push({
        edge: item,
        index: leftQuantity++,
        id: `ins-${leftQuantity}`,
        position: Position.Left,
        type: "target",
        isConnectable: true,
      });
    });
  }

  // Update the node data to include the handles
  updateNodeData(id, {
    ...typedData,
    handles: handles,
  });

  function handleClose() {
  }
</script>

<div class="custom" style={`border-color: ${typedData.color};`}>
  <button class="close-button" on:click={handleClose}>
    <i class="fas fa-cog"></i>
  </button>
  <div class="label">{typedData.name}</div>
  {#each handles as handle (handle.id)}
    <HandleComponent handleInfo={handle} />
  {/each}
</div>

<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">

<style>
  .custom {
    background-color: #eee;
    padding: 10px;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    border-width: 1px;
  }

  .label {
    font-size: 12px;
    margin-bottom: 5px;
    margin-top: 2px;
  }

  .close-button {
    width: 12px;
    height: 12px;
    background-color: grey; 
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
