<script lang="ts">
  export let nodes: any[];

  const onDragStart = (event: DragEvent, node: any) => {
    if (event.dataTransfer) {
      event.dataTransfer.setData(
        "application/svelteflow",
        JSON.stringify(node),
      );
      event.dataTransfer.effectAllowed = "move";
    }
  };
</script>

<aside>
  <div class="mb-0"></div>
  <div class="flexbox items-center justify-center">
    {#each nodes as node}
      <div
        class="output-node node"
        role="button"
        tabindex="0"
        draggable={true}
        on:dragstart={(event) => onDragStart(event, node)}
        title={node.extras.description}
        style={`border-color: ${node.color}`}
      >
        {node.name}
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
    border: 2px  solid #111;
    border-radius: 10px;
    padding: 0.5rem 1rem;
    font-weight: 700;
    border-radius: 3px;
    cursor: grab;
    width: 95%;
    text-align: center;
  }
</style>
