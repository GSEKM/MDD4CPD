<script lang="ts">
    export let nodes: any;

    console.log("nodes", nodes);
</script>

<aside>
    <!-- <h2>{nodes.length()}</h2> -->
    <!-- <div className="description">Arraste os componentes para a esquerda.</div>
    {nodes.map((node, index) => (
      <div
        key={index}
        className={`dndnode ${node.color}`}
        style={{ borderColor: node.color }}
        onDragStart={(event) => onDragStart(event, node)}
        draggable
        title={node.extras.description}
      >
        {node.name}
      </div>
    ))} -->
</aside>
