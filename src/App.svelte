<script lang="ts">
  import { SvelteFlowProvider } from "@xyflow/svelte";
  import "@xyflow/svelte/dist/style.css";
  import Flow from "./Flow.svelte";
</script>

<main>
  <SvelteFlowProvider>
    <Flow />
  </SvelteFlowProvider>
</main>

<style>
  main {
    height: 100vh;
    display: flex;
    flex-direction: column-reverse;
  }
</style>
