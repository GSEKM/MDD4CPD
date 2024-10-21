<script lang="ts">
  import { type NodeProps, useSvelteFlow } from "@xyflow/svelte";
  import { writable, get } from "svelte/store";
  import { updateGlobalCode, globalCode } from "../code/store";

  const { getNodes } = useSvelteFlow();

  // Definindo os props
  type $$Props = NodeProps;

  export let id: $$Props["id"];
  export let data: $$Props["data"];
  const nodes = getNodes();
  const modalNode = nodes.find((n) => n.id === id);

  const sourceNode = nodes.find((n) => n.id === modalNode.data.source);

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
  let selectedRetunType = data.selectedRetunType || "";
  let inputMethodName = data.inputMethodName || "";
  let methodDeclarationLocation = data.methodDeclarationLocation || "";

  let aux_cod = get(globalCode); //variavel auxiliar para armazenar o código global

  const arduinoCode = writable(generateArduinoCode(aux_cod));

  const targetMethods = [{ value: methods }];

  const handleParameterTypeSelect = (event) => {
    selectedType = event.target.value;
  };
  const handleParameterName = (event) => {
    inputParameterName = event.target.value;
  };
  const handleDeclarationLocation = (event) => {
    declarationLocation = event.target.value;
  };

  const handleParameterContent = (event) => {
    inputParameterContent = event.target.value;
  };

  const handleMethodName = (event) => {
    inputMethodName = event.target.value;
  };
  const handleSelectReturnType = (event) => {
    selectedRetunType = event.target.value;
  };
  const handleMehtodDeclarationLocation = (event) => {
    methodDeclarationLocation = event.target.value;
  };

  // Função para verificar se o método já existe no código global
  function methodExists(method, code) {
    const regex = new RegExp(`\\b${method}\\b`);
    return regex.test(code);
  }

  // Função para gerar variáveis e metodos do Arduino
  function generateArduinoPreCode() {
    let codev = "";
    if (typeOfDeclaration == "variables") {
      if (declarationLocation == "global") {
        codev += `${selectedType} ${inputParameterName} = ${inputParameterContent};\n`;
      } else {
        codev += `${selectedType} ${inputParameterName} = ${inputParameterContent};\n`;
      }
    }
    if (typeOfDeclaration == "methods") {
      console.log(
        selectedRetunType,
        inputMethodName,
        methodDeclarationLocation,
      );
      if (methodDeclarationLocation == "global") {
        codev += `${selectedRetunType} ${inputMethodName}();\n\n`;
      }
      if (methodDeclarationLocation != "global") {
        codev += `${selectedRetunType} ${inputMethodName}();\n\n`;
      }
    }
    return codev;
  }

  // Função para gerar o código Arduino
  function generateArduinoCode(codev) {
    let code = codev;
    if (Array.isArray(methods)) {
      methods.forEach((method) => {
        if (!methodExists(method, code)) {
          console.log(method);
          code += `${method} {\n ${declarationLocation == method ? `${selectedType} ${inputParameterName} = ${inputParameterContent} ;\n` : ""}`;
          code += `}\n`;
        }
      });
    }
    return code;
  }

  // Função para atualizar dados e código do node
  function updateNodeDataAndCode() {
    const precode = generateArduinoPreCode();
    const newCode = generateArduinoCode(precode);
    updateGlobalCode(newCode);
    arduinoCode.set(newCode);

    //@ts-ignore
    (sourceNode.data.extras.variables =
      selectedType + " " + inputParameterName),
      (sourceNode.data.extras.parameters = inputParameterContent);

    updateNodeData(sourceNode.id, sourceNode.data);
    updateNodeData(id, {
      selectedType,
      inputParameterName,
      inputParameterContent,
      declarationLocation,
      inputMethodName,
      selectedRetunType,
      text: inputText,
      methods,
      generatedCode: newCode,
    });
  }

  // Função para minimizar (remover) o node
  function handleMinimize() {
    deleteElements({ nodes: [{ id }] });
  }

  function variablesMode() {
    typeOfDeclaration = "variables";
  }

  function methodsMode() {
    typeOfDeclaration = "methods";
  }

  function updateButton() {
    //acessar o id do source
    //update(id, data)

    console.log(typeOfDeclaration);
    updateNodeDataAndCode();
  }

  function addButton() {
    const nodes = getNodes();
    const newNodeId = `node-${Date.now()}`;
    const newNode = {
      id: newNodeId,
      data: { label: "New Node" },
      position: { x: 250, y: 0 },
      type: "default",
    };
    nodes.push(newNode);
  }
</script>

{#if typeOfDeclaration === "variables"}
  <div class="custom">
    <button class="close-button" on:click={handleMinimize}> - </button>
    <div class="declaration-buttons-container">
      <button class="declaration-button" on:click={variablesMode}
        >Variables</button
      >
      <button class="declaration-button" on:click={methodsMode}>Methods</button>
    </div>

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
      <select
        bind:value={declarationLocation}
        on:change={handleDeclarationLocation}
      >
        {#each targetMethods as method}
          <option value="global">global</option>
          {#each method.value as value}
            <option {value}>{value}</option>
          {/each}
        {/each}
      </select>
    </div>
  </div>
{/if}
{#if typeOfDeclaration === "methods"}
  <div class="custom">
    <button class="close-button" on:click={handleMinimize}> - </button>
    <div class="declaration-buttons-container">
      <button class="declaration-button" on:click={variablesMode}
        >Variables</button
      >
      <button class="declaration-button" on:click={methodsMode}>Methods</button>
    </div>

    <div class="label">
      Nome do metodo:
      <input
        bind:value={inputMethodName}
        on:input={handleMethodName}
        placeholder="Nome do metodo"
      />
    </div>

    <div class="label">
      Local de declaração:
      <select
        bind:value={methodDeclarationLocation}
        on:change={handleMehtodDeclarationLocation}
      >
        {#each targetMethods as method}
          <option value="global">global</option>
          {#each method.value as value}
            <option {value}>{value}</option>
          {/each}
        {/each}
      </select>
    </div>

    <div class="label">
      Tipo de Retorno:
      <select bind:value={selectedRetunType} on:change={handleSelectReturnType}>
        {#each int_numbers as option}
          <option value={option.value}>{option.label}</option>
        {/each}
      </select>
    </div>
    <div class="label">
      Adicionar parametros <button class="add-button" on:click={addButton}>
        +
      </button>
    </div>
  </div>
{/if}

<div class="output">
  <pre>{$arduinoCode}</pre>
  <div class="update-button">
    <button class="save-button" on:click={updateButton}>Salvar</button>
  </div>
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
    display: flex;
    align-items: center;
    justify-content: space-between;
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

  .declaration-buttons-container {
    display: flex;
    justify-content: space-evenly;
  }

  .update-button {
    display: flex;
    justify-content: center;
  }

  .save-button {
    width: 80px;
    height: 25px;
    background-color: rgb(96, 94, 245);
    border-radius: 20px;
    color: white;
    font-size: 15px;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    transition: background-color 0.3s;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .add-button {
    width: 20px;
    height: 20px;
    background-color: grey;
    color: white;
    font-size: 15px;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    transition: background-color 0.3s;
    display: flex;
    justify-content: center;
    align-items: center;
  }
</style>
