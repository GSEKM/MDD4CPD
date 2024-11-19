<script lang="ts">
  import {
    Position,
    type NodeProps,
    useSvelteFlow,
    type Node,
  } from "@xyflow/svelte";
  import HandleComponent from "../handles/HandleComponent.svelte";
  import { edges, nodes } from "../code/store";

  // Props
  type $$Props = NodeProps;
  export let id: $$Props["id"];
  export let data: $$Props["data"];

  const { getNodes, updateNodeData } = useSvelteFlow();

  // Função para criar um modal node
  export const createNodeModal = (node: Node) => {
    const sourceNode = getNodes().find((n) => n.id === node.id);
    if (
      !sourceNode ||
      sourceNode.type === "config" ||
      sourceNode.type === "modal"
    )
      return;

    const modalNodeId = `${Date.now()}`; // Gera um ID único

    const newNode: Node = {
      id: modalNodeId,
      type: "config",
      data: {
        inputParameterName: sourceNode.data?.extras?.inputParameterName || "",
        methods: sourceNode.data?.handles?.map((h) => h.edge) || [],
        source: sourceNode.id,
      },
      position: {
        x: sourceNode.position.x - 130,
        y: sourceNode.position.y - 290,
      },
    };

    nodes.update((n) => [...n, newNode]);
  };

  // Interfaces para tipos de dados
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

  interface Handle {
    id: string;
    position: Position;
    type: "source" | "target";
    isConnectable: boolean;
    edge: string;
    index: number;
  }

  // Função para criar handles
  const createHandles = (data: Data) => {
    const handles: Handle[] = [];
    let leftIndex = 0;
    let rightIndex = 0;

    const addHandle = (
      edge: string,
      index: number,
      position: Position,
      type: "source" | "target",
    ) => {
      handles.push({
        edge,
        index,
        id: `${type}-${index}`,
        position,
        type,
        isConnectable: true,
      });
    };

    data.outs?.forEach((edge) =>
      addHandle(edge, rightIndex++, Position.Right, "source"),
    );
    data.ins?.forEach((edge) =>
      addHandle(edge, leftIndex++, Position.Left, "target"),
    );
    data.methods?.forEach((edge) => {
      addHandle(edge, rightIndex++, Position.Right, "source");
      addHandle(edge, leftIndex++, Position.Left, "target");
    });

    return handles;
  };

  const typedData = data as Data;
  const handles = createHandles(typedData);

  // Atualiza os handles no nó
  updateNodeData(id, {
    ...typedData,
    handles,
  });

  // Função para manipular o clique no botão
  export function handleClose() {
    createNodeModal({
      id,
      data: typedData,
      type: "custom",
      position: { x: 0, y: 0 },
    });
    console.log("Modal criado para o nó:", id);
  }
</script>

<div class="custom" style={`border-color: ${typedData.color};`}>
  <div
    class="inner_custom"
    style="display: flex; flex-direction: column; align-items: center; justify-content: center;"
  >
    <div class="label">{typedData.name}</div>

    <button
      class="close-button"
      on:click={handleClose}
      style="margin-bottom: 5px"
    >
      <i class="fas fa-cog"></i>
    </button>
  </div>

  {#each handles as handle (handle.id)}
    <div class="handle_position">
      <HandleComponent handleInfo={handle} />
    </div>
  {/each}
</div>

<link
  rel="stylesheet"
  href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css"
/>

<style>
  .custom {
    background-color: #2d2d2d;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    border-width: 1px;
    color: #fff;
  }

  .label {
    font-size: 15px;
    margin-bottom: 5px;
    font-weight: bold;
    margin: 10px 10px 0 10px;
  }

  .close-button {
    width: 20px;
    height: 20px;
    background-color: grey;
    border-radius: 50%;
    color: white;
    font-size: 12px;
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
