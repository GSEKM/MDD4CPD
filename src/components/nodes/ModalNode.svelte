<script lang="ts">
  import {
    Handle,
    Position,
    type NodeProps,
    useSvelteFlow,
  } from "@xyflow/svelte";
  import { writable } from 'svelte/store';

  type $$Props = NodeProps;

  export let id: $$Props["id"];
  export let data: $$Props["data"];

  const { updateNodeData } = useSvelteFlow();

  const int_numbers = [
    { value: '1', label: '1' },
    { value: '2', label: '2' },
  ];

  const float_numbers = [
    { value: '1.0000', label: '1.0000' },
    { value: '2.0000', label: '2.0000' },
  ];

  let selectedIntOption = data.selectedIntOption || '';
  let selectedFloatOption = data.selectedFloatOption || '';
  let selectedMethodOption = data.selectedMethodOption || '';
  let inputText = data.text || '';
  let methods = data.methods || '';
  let methodsEnd = data.methodsEnd || [];
  
  const targetMethods = [
    { value: methodsEnd }
  ];

  const arduinoCode = writable(generateArduinoCode());

  const handleSelectInt = (event) => {
    selectedIntOption = event.target.value;
    updateNodeDataAndCode();
  };

  const handleSelectFloat = (event) => {
    selectedFloatOption = event.target.value;
    updateNodeDataAndCode();
  };

  const handleSelectMethod = (event) => {
    selectedMethodOption = event.target.value;
    updateNodeDataAndCode();
  };

  const handleTextInput = (event) => {
    inputText = event.target.value;
    updateNodeDataAndCode();
  };

  function generateArduinoCode() {
    let code = '';
    if (methods) {
      code += `${methods}{\n`;
      if (selectedIntOption){
        code += `  int meuInteiro = ${selectedIntOption}\n`;
      }
      if (selectedFloatOption) {
        code += `  float meuFloat = ${selectedFloatOption}\n`;
      }
      if (inputText) {
        code += `  String minhaString = "${inputText}\n"`;
      }
      if (selectedMethodOption) {
        code += `  ${selectedMethodOption}\n`;
      }
      code += `}\n\n`;
    }
    return code;
  }

  function updateNodeDataAndCode() {
    const code = generateArduinoCode();
    arduinoCode.set(code);
    updateNodeData(id, {
      selectedIntOption,
      selectedFloatOption,
      selectedMethodOption,
      text: inputText,
      methods,
      methodsEnd,
      generatedCode: code
    });
  }
</script>

<div class="custom">
  <div class="label">Modal Node</div>
  <div class="label">
    Criar parametro inteiro:
    <select bind:value={selectedIntOption} on:change={handleSelectInt}>
      {#each int_numbers as option}
        <option value={option.value}>{option.label}</option>
      {/each}
    </select>
  </div>

  <div class="label">
    Criar parametro float:
    <select bind:value={selectedFloatOption} on:change={handleSelectFloat}>
      {#each float_numbers as option}
        <option value={option.value}>{option.label}</option>
      {/each}
    </select>
  </div>

  <div class="label">
    Criar parametro String:
    <input
      bind:value={inputText}
      on:input={handleTextInput}
    />
  </div>

  <div class="label">
    Metodos:
    <select bind:value={selectedMethodOption} on:change={handleSelectMethod}>
      {#each targetMethods as method}
        <option value={method.value}>{method.value}</option>
      {/each}
    </select>
  </div>
  <Handle type="source" position={Position.Right} />
  <Handle type="target" position={Position.Left}/>
</div>

<div class="output">
  <pre>{$arduinoCode}</pre>
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

  .output {
    margin-top: 10px;
    background-color: #fff;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 5px;
    white-space: pre-wrap;
  }
</style>
