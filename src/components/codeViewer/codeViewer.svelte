<script lang="ts">
    export let code: string = "";
    export let problems: any[] = [];
    export let onSaveClick: () => void;
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
        background-color: #1d1c1c;
        color: #f8f8f2;
        position: relative;
    }

    .problems {
        color: #ff5555;
        border-width: 2px;
        border-color: #ff5555;
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
        background-color: #2d2d2d;
        color: #f8f8f2;
    }

    code {
        font-family: "Fira Code", "Courier New", Courier, monospace;
        font-size: 1em;
        line-height: 1.5;
        color: #f8f8f2;
        white-space: pre-wrap;
    }

    .save-button {
        background-color: #1d1c1c;
        color: #fff;
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
        margin-bottom: 1rem;
    }

    .save-button:hover {
        background-color: #292929;
    }
</style>
