<script lang="ts">
    import { Background } from "@xyflow/svelte";

    export let nodes: any[]; // exportando a variável node, lista de objetos. let porque o valor varia

    const onDragStart = (event: DragEvent, node: any) => {
        // Usuário começa a arrastar um item
        /* DragEvent = movimento de arrastar; Node = objeto que será arrastado, da lista nodes*/
        if (event.dataTransfer) {
            event.dataTransfer.setData(
                "application/svelteflow",
                JSON.stringify(node),
            );
            event.dataTransfer.effectAllowed = "move";
        }
    };

    const types = Array.from(new Set(nodes.map((node: any) => node.extras.type)));
    console.log(types);
</script>

<aside>
    <div class="mb-0"></div>
    <div class="flexbox items-center justify-center">
        {#each types as type}
            <div class="type-label">{type}</div>
            <div
                style="background-color: white; border: 2px solid black; padding: 3px"
            >
                {#each nodes as node}
                    {#if node.extras.type == type}
                        <div
                            class="output-node node"
                            role="button"
                            tabindex="0"
                            draggable={true}
                            on:dragstart={(event) => onDragStart(event, node)}
                            title={node.extras.description}
                            style="{`border-color: ${node.color}`};"
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
        width: 20%;
        background: #f4f4f4;
        font-size: 12px;
        display: flex;
        flex-direction: column;
        overflow: auto;
    }

    .node {
        margin: 0.5rem;
        border: 2px solid #c57272;
        border-radius: 10px;
        padding: 0.5rem 1rem;
        font-weight: 700;
        border-radius: 3px;
        cursor: grab;
        width: 95%;
        text-align: center;
    }

    .type-label {
        font-size: 15px;
        text-align: center;
        font-weight: bold;
        margin: 3px;
        margin-top: 17px;
        color: #0f0a0a;
        border-radius: 15px;
    }
</style>
