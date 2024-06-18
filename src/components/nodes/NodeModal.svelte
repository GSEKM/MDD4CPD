<script lang="ts">
  import { type NodeProps, useSvelteFlow } from "@xyflow/svelte";
  import { writable, get } from "svelte/store";
  import { updateGlobalCode, globalCode } from "../code/store";

  // Definindo os props
  type $$Props = NodeProps;

  export let id: $$Props["id"];
  export let data: $$Props["data"];

  // Instanciando a svelteFlow store
  const { updateNodeData, deleteElements } = useSvelteFlow();

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
  let methods = data.methods || [];
  let aux_cod = get(globalCode);
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

  // Função para verificar se o método já existe no código global
  function methodExists(method, code) {
    const regex = new RegExp(`\\b${method}\\b`);
    return regex.test(code);
  }

  // Função para gerar variáveis do Arduino
  function generateArduinoVariables() {
    let codev = "";
    if (selectedIntOption) {
      codev += `int meuInteiro = ${selectedIntOption};\n`;
    }
    if (selectedFloatOption) {
      codev += `float meuFloat = ${selectedFloatOption};\n`;
    }
    if (inputText) {
      codev += `String minhaString = "${inputText}";\n`;
    }
    if (inputMethod && !methodExists(inputMethod, aux_cod)) {
      codev += `${inputMethod}(){}\n`;
    }
    return codev;
  }

  // Função para gerar o código Arduino
  function generateArduinoCode(codev) {
    let code = codev;
    if (Array.isArray(methods)) {
      methods.forEach((method) => {
        if (!methodExists(method, code)) {
          code += `${method} {\n`;
          code += `}\n`;
        }
      });
    }
    return code;
  }

  // Função para atualizar dados e código do node
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

  // Função para minimizar (remover) o node
  function handleMinimize() {
    deleteElements({ nodes: [{ id }] });
  }
</script>

<div class="custom">
  <button class="close-button" on:click={handleMinimize}>
    -
  </button>
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
    display: flex;
    flex-direction: column;
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

  .close-button {
    width: 10px;
    height: 10px;
    background-color: grey; 
    border-radius: 50%; 
    color: white; 
    font-size: 20px;
    cursor: pointer; 
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2); 
    transition: background-color 0.3s; 
    display: flex;
    justify-content: center;
    align-items: center;
    align-self: flex-end;
  }

  .close-button:hover {
    background-color: #a19d9d; 
  }

  .close-button:focus {
    outline: none; 
  }
</style>
