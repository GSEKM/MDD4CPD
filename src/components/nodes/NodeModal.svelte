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
    { value: "int", label: "int" },
    { value: "float", label: "float" },
    { value: "double", label: "double" },
    { value: "char", label: "char" },
    { value: "String", label: "String" },
    { value: "bool", label: "bool" },
  ];

  let selectedType = data.selectedType || "";
  let inputText = data.text || "";
  let inputParameterName = data.inputParameterName || "";
  let methods = data.methods || [];
  let inputParameterContent = data.inputParameterContent || "";
  let declarationLocation = data.declarationLocation || "";
  let typeOfDeclaration = data.typeOfDeclaration || "variables";

  let aux_cod = get(globalCode); //variavel auxiliar para armazenar o código global

  const arduinoCode = writable(generateArduinoCode(aux_cod));
  
  const targetMethods = [
    { value: methods}
  ];
  console.log(targetMethods)
  const handleParameterTypeSelect = (event) => {
    selectedType = event.target.value;
    updateNodeDataAndCode();
  };
  const handleParameterName = (event) => {
    inputParameterName = event.target.value;
    updateNodeDataAndCode();
  };
  const handleDeclarationLocation = (event) => {
    declarationLocation = event.target.value;
    updateNodeDataAndCode();
  };

  const handleParameterContent = (event) => {
    inputParameterContent = event.target.value;
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
    if (declarationLocation == "global") {
      codev += `${selectedType} ${inputParameterName} = ${inputParameterContent};\n`;
    }
    return codev;
  }

  // Função para gerar o código Arduino
  function generateArduinoCode(codev) {
    let code = codev;
    if (Array.isArray(methods)) {
      methods.forEach((method) => {
        if (!methodExists(method, code)) {
          code += `${method} {\n ${declarationLocation == method ? `${selectedType} ${inputParameterName} = ${inputParameterContent} ;\n` : ''}`;
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
      selectedType,
      inputParameterName,
      declarationLocation,
      text: inputText,
      methods,
      generatedCode: newCode,
    });
  }

  // Função para minimizar (remover) o node
  function handleMinimize() {
    deleteElements({ nodes: [{ id }] });
  }



  function handleTypeOfDeclaration() {
    typeOfDeclaration = typeOfDeclaration === "variables" ? "methods" : "variables";
  }
</script>

{#if typeOfDeclaration === "variables"}
  <div class="custom">
    <button class="close-button" on:click={handleMinimize}> - </button>
    <button class="declaration-button" on:click={handleTypeOfDeclaration}>{typeOfDeclaration}</button>

    <div class="label">
      Nome do parametro:
      <input
        bind:value={inputParameterName}
        on:input={handleParameterName}
        placeholder="Nome do parametro"
      />
    </div>

    <div class="label">
      Tipo de parametro:
      <select bind:value={selectedType} on:change={handleParameterTypeSelect}>
        {#each int_numbers as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </div>

    <div class="label">
      Conteudo do parametro:
      <input
        bind:value={inputParameterContent}
        on:input={handleParameterContent}
        placeholder=""
      />
    </div>

    <div class="label">
      Local de declaração:
      <select bind:value={declarationLocation} on:change={handleDeclarationLocation}>
        {#each targetMethods as method}
          <option value="global">global</option>
          {#each method.value as value}
            <option value={value}>{value}</option>
          {/each}
        {/each}
      </select>
    </div>
  </div>
{/if}
{#if typeOfDeclaration === "methods"}
  <div class="custom">
    <button class="close-button" on:click={handleMinimize}> - </button>
    <button class="declaration-button" on:click={handleTypeOfDeclaration}>{typeOfDeclaration}</button>
   
    <div class="label">
      Nome do metodo:
      <input
        bind:value={inputParameterName}
        on:input={handleParameterName}
        placeholder="Nome do parametro"
      />
    </div>

    <div class="label">
      Local de declaração:
      <select bind:value={declarationLocation} on:change={handleDeclarationLocation}>
        {#each targetMethods as method}
          <option value="global">global</option>
          {#each method.value as value}
            <option value={value}>{value}</option>
          {/each}
        {/each}
      </select>
    </div>

    <div class="label">
      retorno:
      <select bind:value={selectedType} on:change={handleParameterTypeSelect}>
        {#each int_numbers as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </div>


  </div>
{/if}

<div class="output">
  <pre>{$arduinoCode}</pre>
</div>

<style>
  .custom {
    background-color: #eee;
    padding: 10px;
    border-radius: 10px;
    height: 160px;
    width: 300px;
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

  .declaration-button {
    width: 100px;
    height: 25px;
    background-color: grey;
    border-radius: 20px;
    color: white;
    font-size: 20px;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    transition: background-color 0.3s;
    display: flex;
    justify-content: center;
    align-items: center;
    align-self: center;
    margin-bottom: 5%;
  }

  .declaration-button:hover {
    background-color: #a19d9d;
  }

  .declaration-button:focus {
    outline: none;
  }
</style>
