<script lang="ts">
  import {
    Handle,
    Position,
    type NodeProps,
    useSvelteFlow,
  } from "@xyflow/svelte";

  import { initialNodes, initialEdges } from './edges_and_nodes';

  type $$Props = NodeProps;

  export let id: $$Props["id"];
  export let data: $$Props["data"];

  const { updateNodeData } = useSvelteFlow();

  // Define as opçoes do select menu
  const int_numbers = [
    { value: '1', label: '1' },
    { value: '2', label: '2' },
    
  ];

  const float_numbers = [
    { value: '1,0000', label: '1,0000' },
    { value: '2,0000', label: '2,0000' },
    
  ];

  let selectedOption;
  const handleSelect = (event) => {
    selectedOption = event.target.value;
    updateNodeData(id, {select: event.currentTarget.value })
    //  Pego a opção selecionada
    
  };
</script>

<div class="custom">
  <div class="label">Modal Node</div>
  <div class="label">
    Criar parametro inteiro:
    <select bind:value={selectedOption} on:change={handleSelect}>
      {#each int_numbers as option}
        <option value={option.value}>{option.label}</option>
      {/each}
    </select>
  </div>

  <div class="label">
    Criar parametro float:
    <select bind:value={selectedOption} on:change={handleSelect}>
      {#each float_numbers as option}
        <option value={option.value}>{option.label}</option>
      {/each}
    </select>
  </div>

  <div class="label">
    Criar parametro String:
    <input
      value={data.text}
      on:input={(evt) => updateNodeData(id, { text: evt.currentTarget.value })}
    />
  </div>
  <Handle type="source" position={Position.Right} />
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
