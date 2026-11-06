<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { categoryOf, categoryOrder, plainText } from "../categories";
  import { importedLibraries, paletteKey, removeLibrary } from "../../libraries/store";

  const dispatch = createEventDispatcher<{ libraries: void }>();

  export let nodes: any[] = [];

  const onDragStart = (event: DragEvent, node: any) => {
    if (!event.dataTransfer) return;
    event.dataTransfer.setData("application/svelteflow", JSON.stringify(node));
    event.dataTransfer.effectAllowed = "move";
  };

  let searchTerm = "";
  let collapsed: Record<string, boolean> = {};

  function matches(node: any, term: string) {
    if (!term) return true;
    const t = term.toLowerCase();
    return (
      node.name.toLowerCase().includes(t) ||
      (node.methods || []).some((m: string) => m.toLowerCase().includes(t)) ||
      (node.extras.library || "").toLowerCase().includes(t)
    );
  }

  $: groups = categoryOrder
    .map((key) => {
      const items = nodes.filter(
        (n) => categoryOf(n.extras.type).key === key && matches(n, searchTerm),
      );
      return { cat: categoryOf(key), items };
    })
    .filter((g) => g.items.length > 0);

  function subtitle(node: any) {
    const t = node.extras.type;
    if (t === "controller")
      return `${node.extras.digitalPorts} digital · ${node.extras.analogPorts} analog`;
    if (t === "component")
      return node.extras.packageName
        ? `${node.extras.packageName} ${node.extras.version}`
        : node.extras.library || "component";
    const n = node.methods?.length || 0;
    if (t === "built-in" && n) return `${n} function${n > 1 ? "s" : ""}`;
    return "";
  }

  function tooltip(node: any) {
    const parts = [plainText(node.extras.description)];
    if (node.methods?.length) parts.push(node.methods.join("\n"));
    return parts.filter(Boolean).join("\n\n") || node.name;
  }
</script>

<aside>
  <div class="search">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
      ><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg
    >
    <input
      type="text"
      bind:value={searchTerm}
      placeholder="Search blocks or functions"
      class="ui-input"
    />
    {#if searchTerm}
      <button class="clear" on:click={() => (searchTerm = "")} title="Clear search">×</button>
    {/if}
  </div>

  <div class="groups">
    {#each groups as { cat, items } (cat.key)}
      <section style="--cat: {cat.color}">
        <button
          class="group-header"
          on:click={() => (collapsed[cat.key] = !collapsed[cat.key])}
          title={cat.hint}
          aria-expanded={!collapsed[cat.key] || !!searchTerm}
        >
          <svg
            class="chevron"
            class:closed={collapsed[cat.key] && !searchTerm}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"><path d="m6 9 6 6 6-6" /></svg
          >
          <span class="dot"></span>
          <span class="group-label">{cat.label}</span>
          <span class="count">{items.length}</span>
        </button>

        {#if !collapsed[cat.key] || searchTerm}
          <div class="items">
            {#each items as node (paletteKey(node))}
              <div
                class="item"
                role="button"
                tabindex="0"
                draggable={true}
                on:dragstart={(event) => onDragStart(event, node)}
                title={tooltip(node)}
              >
                <span class="bar"></span>
                <span class="name">{node.name}</span>
                {#if subtitle(node)}<span class="sub">{subtitle(node)}</span>{/if}
              </div>
            {/each}
            {#if cat.key === "component"}
              <button class="add-lib" on:click={() => dispatch("libraries")}>
                + Add an Arduino library…
              </button>
            {/if}
          </div>
        {/if}
      </section>
    {:else}
      <p class="empty">No blocks match “{searchTerm}”.</p>
    {/each}
  </div>

  {#if $importedLibraries.length > 0}
    <div class="imported">
      <div class="imported-title">Imported libraries</div>
      {#each $importedLibraries as lib (lib.name)}
        <div class="lib" title={`${lib.components.length} blocks · ${lib.checksum}`}>
          <span class="lib-name">{lib.name}</span>
          <span class="lib-ver">{lib.version}</span>
          <button
            on:click={() => removeLibrary(lib.name)}
            title="Remove from the palette (blocks already on the canvas stay)">×</button
          >
        </div>
      {/each}
    </div>
  {/if}

  <footer>Drag blocks onto the canvas · <kbd>Ctrl K</kbd> to search</footer>
</aside>

<style>
  aside {
    width: 248px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: var(--panel);
    border-right: 1px solid var(--border);
    min-height: 0;
  }

  .search {
    position: relative;
    padding: 10px;
    border-bottom: 1px solid var(--border);
  }
  .search svg {
    position: absolute;
    left: 19px;
    top: 50%;
    width: 14px;
    height: 14px;
    transform: translateY(-50%);
    color: var(--text-3);
    pointer-events: none;
  }
  .search input {
    width: 100%;
    height: 30px;
    padding-left: 28px;
    padding-right: 24px;
  }
  .clear {
    position: absolute;
    right: 16px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-3);
    font-size: 16px;
    line-height: 1;
  }
  .clear:hover {
    color: var(--text);
  }

  .groups {
    flex: 1;
    overflow-y: auto;
    padding: 6px 0 12px;
  }

  .group-header {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    padding: 7px 12px;
    color: var(--text-2);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .group-header:hover {
    color: var(--text);
  }
  .chevron {
    width: 12px;
    height: 12px;
    transition: transform 0.15s;
    color: var(--text-3);
  }
  .chevron.closed {
    transform: rotate(-90deg);
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--cat);
  }
  .group-label {
    flex: 1;
    text-align: left;
  }
  .count {
    color: var(--text-3);
    font-weight: 500;
  }

  .items {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 8px 6px;
  }

  .item {
    position: relative;
    display: flex;
    flex-direction: column;
    padding: 6px 10px 6px 14px;
    border-radius: var(--radius-sm);
    border: 1px solid transparent;
    cursor: grab;
    user-select: none;
    transition: background 0.1s, border-color 0.1s;
  }
  .item:hover {
    background: var(--panel-2);
    border-color: var(--border);
  }
  .item:active {
    cursor: grabbing;
  }
  .bar {
    position: absolute;
    left: 4px;
    top: 7px;
    bottom: 7px;
    width: 3px;
    border-radius: 3px;
    background: var(--cat);
  }
  .name {
    color: var(--text);
    font-weight: 500;
    font-size: 13px;
  }
  .sub {
    color: var(--text-3);
    font-size: 11px;
    margin-top: 1px;
  }

  .empty {
    padding: 16px;
    color: var(--text-3);
    text-align: center;
  }

  .add-lib {
    margin: 4px 2px 0;
    padding: 6px 10px;
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius-sm);
    color: var(--text-3);
    font-size: 12px;
    text-align: left;
  }
  .add-lib:hover {
    color: var(--cat-component);
    border-color: var(--cat-component);
  }
  .imported {
    padding: 8px 10px;
    border-top: 1px solid var(--border);
    max-height: 30%;
    overflow-y: auto;
  }
  .imported-title {
    color: var(--text-3);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .lib {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 2px;
    font-size: 12px;
  }
  .lib-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .lib-ver {
    color: var(--text-3);
  }
  .lib button {
    color: var(--text-3);
    width: 18px;
  }
  .lib button:hover {
    color: var(--error);
  }
  footer kbd {
    padding: 0 4px;
    border: 1px solid var(--border-strong);
    border-radius: 3px;
    font-family: var(--font);
    font-size: 10px;
  }
  footer {
    padding: 8px 12px;
    border-top: 1px solid var(--border);
    color: var(--text-3);
    font-size: 11px;
    text-align: center;
  }
</style>
