<script lang="ts">
  import {
    Handle,
    Position,
    type NodeProps,
    useSvelteFlow,
    type Edge,
  } from "@xyflow/svelte";
  import { writable } from "svelte/store";
  import { edges } from "../code/store";
  //Defining the props
  type $$Props = NodeProps;

  export let id: $$Props["id"];
  export let data: $$Props["data"];

  //instantiating the svelteFlow store
  const { updateNodeData, deleteElements, getEdges } = useSvelteFlow();

  let selectedParameter = data.selectedParameter || "";

  let methods = data.methods || "";
  let methodsEnd = data.methodsEnd || [];

  const arduinoCode = writable(generateArduinoCode());
  let parametersInput = data?.inputParameterName || "";

  function generateArduinoCode() {
    let code = "";
    if (methods) {
      code += `${methods}{\n`;
      code += `  ${methodsEnd}\n`;
      code += `}\n\n`;
    }
    return code;
  }

  function updateMethodsEnd() {
    if (Array.isArray(methodsEnd)) {
      // Itera sobre cada item no array methodsEnd
      methodsEnd = methodsEnd.map((method) => {
        if (method.includes("(")) {
          // Substitui o conteúdo dentro dos parênteses pelo selectedParameter
          return method.replace(/\(.*?\)/, `(${selectedParameter})`);
        } else {
          // Se não houver parênteses, adiciona-os com o selectedParameter
          return `${method}(${selectedParameter})`;
        }
      });
    }
  }

  function updateNodeDataAndCode() {
    updateMethodsEnd();
    const code = generateArduinoCode();
    arduinoCode.set(code);
    updateNodeData(id, {
      selectedParameter,
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

    // Create a new edge between the nodes that were connected to the current node
    const newEdge: Edge[] = [
      {
        id: `${edge1.id.substring(0, edge1.id.lastIndexOf("-") - 1)}1`,
        type: edge1.type || "default", // Assuming the same type as the first edge
        source: newSource,
        sourceHandle: edge1.sourceHandle,
        target: newTarget,
        targetHandle: edge2.targetHandle,
        data: { ...data, parametersInput },
      },
    ];

    // Add the new edge
    edges.update((e) => [...e, ...newEdge]);

    // Delete the current node and its edges
    deleteElements({ nodes: [{ id }] });
  }

  // Geting the parameters from the source node
  const edges_aux = getEdges().filter(
    (edge) => edge.source === id || edge.target === id,
  );

  const [edge1] = edges_aux;

  const newSource = edge1.source === id ? edge1.target : edge1.source;

  const { getNodes } = useSvelteFlow();
  const nodes = getNodes();

  const sourceNode = nodes.find((n) => n.id === newSource);

  let parameters = [
    {
      //@ts-ignore
      value: sourceNode.data.extras.parameters,
      //@ts-ignore
      label: sourceNode.data.extras.variables,
    },
  ];

  const handleParameterSelect = (event) => {
    selectedParameter = event.target.value;
    updateNodeDataAndCode();
  };
</script>

<div class="custom">
  <button class="close-button" on:click={handleMinimize}> - </button>
  <div class="label">
    Parameters:
    <select bind:value={selectedParameter} on:change={handleParameterSelect}>
      {#each parameters as option}
        <option value={option.label}>{option.label}</option>
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
