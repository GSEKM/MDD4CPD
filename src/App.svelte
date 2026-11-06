<script lang="ts">
  import { SvelteFlowProvider } from "@xyflow/svelte";
  import "@xyflow/svelte/dist/style.css";
  import Flow from "./Flow.svelte";
</script>

<SvelteFlowProvider>
  <Flow />
</SvelteFlowProvider>
