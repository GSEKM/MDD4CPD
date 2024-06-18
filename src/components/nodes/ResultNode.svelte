<script lang="ts">
  import { Handle, Position, type NodeProps } from "@xyflow/svelte";
  import { globalCode } from "../code/store";
  import { get } from "svelte/store";

  type $$Props = NodeProps;

  export let id: $$Props["id"];

  const code = get(globalCode);
</script>

<div class="custom">
  <div class="label">Generated Arduino Code:</div>
  <div>
    <pre>{code}</pre>
  </div>
</div>

<style>
  .custom {
    background-color: #eee;
    padding: 10px;
    border-radius: 10px;
    font-size: 12px;
  }

  .label {
    margin-bottom: 5px;
  }

  pre {
    background-color: #f8f8f8;
    padding: 10px;
    border: 1px solid #ccc;
    border-radius: 5px;
    white-space: pre-wrap;
  }
</style>
