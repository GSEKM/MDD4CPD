<script lang="ts">
    export let code: string = "";
    export let problems: any[] = [];

    import { onMount } from "svelte";
    import Prism from "prismjs";
    import "prismjs/themes/prism.css";

    // Realçar o código usando Prism
    onMount(() => {
        Prism.highlightAll();
    });
</script>

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
<pre><code class="language-clike">{code}</code></pre>

<style>
    pre {
        color: #f8f8f2;
        padding: 1em;
        border-radius: 5px;
        overflow: auto;
        left: 0;
        height: 100vh;
        width: 50vw;
    }

    .problems {
        color: #ff5555;
        margin-top: 1em;
    }

    h4 {
        margin-bottom: 0.5em;
    }

    ul {
        list-style-type: disc;
        padding-left: 1.5em;
    }
</style>
