<script lang="ts">
  import { type NodeProps, useSvelteFlow } from "@xyflow/svelte";
  import { writable } from "svelte/store";
  import { updateGlobalCode } from "../code/store";

  //Defining the props
  type $$Props = NodeProps;

  export let id: $$Props["id"];
  export let data: $$Props["data"];

  //instantiating the svelteFlow store
  const { updateNodeData } = useSvelteFlow();

  const int_numbers = [
    { value: "1", label: "1" },
    { value: "2", label: "2" },
  ];

  const float_numbers = [
    { value: "1.0000", label: "1.0000" },
    { value: "2.0000", label: "2.0000" },
  ];

  let selectedIntOption = data.selectedIntOption || "";
  let selectedFloatOption = data.selectedFloatOption || "";
  let inputText = data.text || "";
  let inputMethod = data.inputMethod || "";
  let methods = data.methods || "";
  let aux_cod = "";
  const arduinoCode = writable(generateArduinoCode(aux_cod));

  const handleSelectInt = (event) => {
    selectedIntOption = event.target.value;
    updateNodeDataAndCode();
  };

  const handleSelectFloat = (event) => {
    selectedFloatOption = event.target.value;
    updateNodeDataAndCode();
  };

  const handleTextInput = (event) => {
    inputText = event.target.value;
    updateNodeDataAndCode();
  };

  const handleMethodInput = (event) => {
    inputMethod = event.target.value;
    updateNodeDataAndCode();
  };

  //here only global variables will be created
  function generateArduinoVariables() {
    let codev = "";
    if (selectedIntOption) {
      codev += `int meuInteiro = ${selectedIntOption};\n`;
    }
    if (selectedFloatOption) {
      codev += `float meuFloat = ${selectedFloatOption};\n`;
    }
    if (inputText) {
      codev+= `String minhaString = "${inputText}";\n`;
    }
    if (inputMethod) {
      codev += `${inputMethod}(){}\n`;
    }
    return codev;
  }

  function generateArduinoCode(codev) {
    let code = codev;
    if (Array.isArray(methods)) {
      methods.forEach((method) => {
        code += `${method}{\n`;
        code += `}\n`;
      });
    }
    return code;
  }


 
  function updateNodeDataAndCode() {
    const code_variables = generateArduinoVariables();
    const newCode = generateArduinoCode(code_variables);
    updateGlobalCode(newCode);
    arduinoCode.set(newCode);
    updateNodeData(id, {
      selectedIntOption,
      selectedFloatOption,
      inputMethod,
      text: inputText,
      methods,
      generatedCode: newCode,
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
    <input bind:value={inputText} on:input={handleTextInput} />
  </div>
  <div class="label">
    Criar metodo:
    <input bind:value={inputMethod} on:input={handleMethodInput} />
  </div>
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
