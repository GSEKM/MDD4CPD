<script lang="ts">
  import {
    Position,
    type NodeProps,
    useSvelteFlow,
  } from "@xyflow/svelte";
  import HandleComponent from "./HandleComponent.svelte";

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
  }

  const typedData = data as Data;

  data.text = "testing for uppercase";

  const { updateNodeData } = useSvelteFlow();

  const handles = [];


  if (typedData.outs) {
    let rightQuantity = 0;
    typedData.outs.forEach((item) => {
      handles.push({
        edge: item,
        index: rightQuantity++,
        id: `outs-${rightQuantity}`,
        position: Position.Right,
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
      });
    });

    typedData.methods.forEach((item) => {
      handles.push({
        edge: item,
        index: leftQuantity++,
        id: `ins-${leftQuantity}`,
        position: Position.Left,
      });
    });
  }
  
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
