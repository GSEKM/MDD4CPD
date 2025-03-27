<script lang="ts">
    import { Background } from "@xyflow/svelte";
    import { backIn } from "svelte/easing";

    export let nodes: any[] = []; // Inicializando com uma lista vazia

    // Função chamada ao começar a arrastar um item
    const onDragStart = (event: DragEvent, node: any) => {
        if (event.dataTransfer) {
            event.dataTransfer.setData(
                "application/svelteflow", // o erro que impedia o drag and drop de funcionar foi corrigido, o problema era que a referencia estava como "application/json" e não "application/svelteflow"
                JSON.stringify(node),
            );
            event.dataTransfer.effectAllowed = "move";
        }
    };

    // Obtendo os tipos únicos dos nós
    const types = Array.from(
        new Set(nodes.map((node: any) => node.extras.type)),
    );

    let searchTerm = "";

    $: filteredNodes = searchTerm
        ? nodes.filter(node =>
            node.name.toLowerCase().includes(searchTerm.toLowerCase())
        ) : nodes;

    $: visibleTypes = Array.from(
        new Set(filteredNodes.map((node: any) => node.extras.type))
    );
</script>

<aside>
    <div class="search-container">
        <input
            type="text"
            bind:value={searchTerm}
            placeholder="Pesquisar"
            class="search-input"
            />
    </div>

    <div class="flexbox items-center justify-center">
        {#each visibleTypes as type}
            <div class="type-label">{type.toUpperCase()}</div>
            <div
                style="background-color: #2d2d2d; border: 2px dashed white; padding: 5px; color: white"
            >
                {#each filteredNodes as node (node.name)}
                    {#if node.extras.type == type}
                        <div
                            class="output-node node"
                            role="button"
                            tabindex="0"
                            draggable={true}
                            on:dragstart={(event) => onDragStart(event, node)}
                            title={node.extras.description}
                            style="border-color: {node.color};"
                        >
                            {node.name}
                        </div>
                    {/if}
                {/each}
            </div>
        {/each}
    </div>
</aside>

<style>
    aside {
        width: 25%;
        background: #f4f4f4;
        font-size: 12px;
        display: flex;
        flex-direction: column;
        overflow: auto;
        background-color: #2d2d2d;
        scrollbar-width: none; /* Firefox */
    }

    .node {
        margin: 0.5rem;
        border: 2px solid #c57272;
        border-radius: 10px;
        padding: 0.5rem 1rem;
        font-weight: 700;
        cursor: grab;
        width: 95%;
        text-align: center;
        background-color: black;
    }

    .type-label {
        font-size: 15px;
        text-align: center;
        font-weight: bold;
        margin: 3px;
        margin-top: 17px;
        color: #fff;
    }
    
    .search-container{
        padding: 10px;
        top: 0;
        position: sticky;
        z-index: 10;
    }

    .search-input {
        width: 100%;
        padding: 8px;
        border-radius: 5px;
        border: 1px solid #444;
        background-color: #1a1a1a;
        color: white;
    }
</style>
