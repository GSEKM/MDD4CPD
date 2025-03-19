<script lang="ts">
    import { Background } from "@xyflow/svelte";
    import { backIn } from "svelte/easing";

    export let nodes: any[] = []; // Inicializando com uma lista vazia

    const onDrop = (event: DragEvent) => {
        if (event.dataTransfer) {
            const data = event.dataTransfer.getData("application/json");
            const node = JSON.parse(data);
            //
        }
    };
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

    const addArduinoLibrary = async () => {
        const library = prompt("Digite o caminho do arquivo .h");
        if (library) {
            try {
                if (library.endsWith(".h") || library.endsWith(".zip")) {
                    // Faz o upload da biblioteca
                    const response = await fetch("/add-library", {
                        method: "POST",
                        body: JSON.stringify({ libraryPath: library }),
                        headers: { "Content-Type": "application/json" },
                    });

                    if (response.ok) {
                        alert("Biblioteca adicionada com sucesso!");
                        nodes.push({
                            name: library.split("/").pop(),
                            extras: {
                                type: "arduino",
                                description: "Biblioteca Arduino",
                            },
                            color: "#4caf50",
                        });
                    } else {
                        throw new Error("Erro ao adicionar a biblioteca");
                    }
                } else {
                    alert(
                        "Por favor, insira o caminho de um arquivo .zip válido.",
                    );
                }
            } catch (error) {
                alert(`Erro: ${error.message}`);
            }
        }
    };
</script>

<aside>
    <div class="flexbox items-center justify-center">
        <button class="button" on:click={addArduinoLibrary}
            >Adicionar biblioteca</button
        >
    </div>

    <div class="flexbox items-center justify-center">
        {#each types as type}
            <div class="type-label">{type.toUpperCase()}</div>
            <div
                style="background-color: #2d2d2d; border: 2px dashed white; padding: 5px; color: white"
            >
                {#each nodes as node (node.name)}
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

    .button {
        background-color: #171724;
        color: white;
        padding: 15px 35px;
        cursor: pointer;
        border-radius: 15px;
        font-size: 12px;
        text-align: center;
        font-weight: bold;
        margin: 50px;
    }
</style>
