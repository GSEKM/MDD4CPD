<script lang="ts">
  import {
    Handle,
    Position,
    type NodeProps,
    useSvelteFlow,
    type Edge,
  } from "@xyflow/svelte";
  import { writable } from "svelte/store";
  import { edges } from '../code/store';

  //Defining the props
  type $$Props = NodeProps;

  export let id: $$Props["id"];
  export let data: $$Props["data"];

  //instantiating the svelteFlow store
  const { updateNodeData, deleteElements, getEdges } = useSvelteFlow();


  let selectedMethodOption = data.selectedMethodOption || "";

  let methods = data.methods || "";
  let methodsEnd = data.methodsEnd || [];

  // procurar por === nome do metodo para passar paramentros para o metodo
  //Getting methods from target node
  
  const targetMethods = [{ value: methodsEnd }];

  const arduinoCode = writable(generateArduinoCode());

  const handleSelectMethod = (event) => {
    selectedMethodOption = event.target.value;
    updateNodeDataAndCode();
  };

  function generateArduinoCode() {
    let code = "";
    if (methods) {
      code += `${methods}{\n`;
      code += `  ${methodsEnd}()\n`;
      code += `}\n\n`;
    }
    return code;
  }

  function updateNodeDataAndCode() {
    const code = generateArduinoCode();
    arduinoCode.set(code);
    updateNodeData(id, {
      selectedMethodOption,
      methods,
      methodsEnd,
      generatedCode: code,
    });
  }



  function handleMinimize() {
    // Get the edges connected to this node
    const edges_aux = getEdges().filter(
      (edge) => edge.source === id || edge.target === id,
    );

    const [edge1, edge2] = edges_aux;

    const newSource = edge1.source === id ? edge1.target : edge1.source;
    const newTarget = edge2.source === id ? edge2.target : edge2.source;

    console.log(newSource, newTarget);
    // Create a new edge between the nodes that were connected to the current node
    const newEdge: Edge[] = [
      {
        id: `edge-${newSource}-${newTarget}`,
        type: edge1.type || "default", // Assuming the same type as the first edge
        source: newSource,
        target: newTarget,
        data: data
      },
    ];

    // Add the new edge
    edges.update((e) => [...e, ...newEdge]);

    // Delete the current node and its edges
    deleteElements({ nodes: [{ id }] });
  }
</script>

<div class="custom">
  <button class="close-button" on:click={handleMinimize}> - </button>
  <div class="label">
    Parameters:
    <select bind:value={selectedMethodOption} on:change={handleSelectMethod}>
      {#each targetMethods as method}
        <option value={method.value}>{method.value}</option>
      {/each}
    </select>
  </div>
  <Handle type="source" position={Position.Right} />
  <Handle type="target" position={Position.Left} />
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
