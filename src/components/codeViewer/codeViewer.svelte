<script lang="ts">
    export let code: string = "";
    export let problems: any[] = [];
    export let onSaveClick: () => void; // Recebe a função de salvar como prop
    import { onMount } from "svelte";
    import Prism from "prismjs";
    import "prismjs/themes/prism.css";
    import "prismjs/components/prism-clike";

    // Realçar o código usando Prism
    onMount(() => {
        Prism.highlightAll();
    });
</script>

<div class="code-viewer">
    <!-- Exibir os problemas detectados -->
    {#if problems.length > 0}
        <div class="problems">
            <h4>Problemas Detectados:</h4>
            <ul>
                {#each problems as problem}
                    <li>{problem.message}</li>
                {/each}
            </ul>
        </div>
    {/if}

    <!-- Exibir o código gerado -->
    <pre>
        <code class="language-clike">{code}</code>
    </pre>

    <!-- Botão de salvar -->
    <button class="save-button" on:click={onSaveClick}>Salvar</button>
</div>

<style>
    .code-viewer {
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        align-items: flex-start;
        height: 100vh;
        width: 50vw;
        overflow: hidden;
        padding: 1em;
        box-sizing: border-box;
        background-color: #282a36;
        color: #f8f8f2;
        position: relative;
    }

    .problems {
        color: #ff5555;
        margin-bottom: 1em;
        width: 100%;
        justify-items: center;
    }

    h4 {
        margin-bottom: 0.5em;
    }

    ul {
        list-style-type: disc;
        padding-left: 1.5em;
    }

    pre {
        flex-grow: 1;
        width: 100%;
        padding: 1em;
        margin: 0;
        border-radius: 5px;
        overflow: auto;

        color: #f8f8f2;
    }

    .save-button {
        background-color: #f8f8f2;
        color: #282a36;
        border: none;
        padding: 0.5em 1em;
        border-radius: 5px;
        margin-top: 1em;
        cursor: pointer;
        height: 5vh;
        position: absolute;
        bottom: 1em;
        left: 50%;
        transform: translateX(-50%);
    }

    .save-button:hover {
        background-color: #e6e6e6;
    }
</style>
