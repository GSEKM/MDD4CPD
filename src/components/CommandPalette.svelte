<script lang="ts">
  import { createEventDispatcher, onMount, tick } from "svelte";
  import { categoryOf } from "./categories";
  import {
    importLibrary,
    loadIndex,
    searchIndex,
    type LibraryEntry,
  } from "../libraries/importer";
  import { addLibrary, importedLibraries, palette, paletteKey } from "../libraries/store";

  export let initialMode: "all" | "libraries" = "all";

  const dispatch = createEventDispatcher<{ add: any; close: void }>();

  let query = "";
  let input: HTMLInputElement;
  let active = 0;
  let index: LibraryEntry[] | null = null;
  let indexError = "";
  let importing: string | null = null;
  let importError = "";

  onMount(async () => {
    await tick();
    input?.focus();
    try {
      index = await loadIndex();
    } catch (e: any) {
      indexError = e?.message || "Could not load the Arduino library index";
    }
  });

  $: q = query.trim().toLowerCase();
  $: blockResults =
    initialMode === "libraries" || !q
      ? []
      : $palette
          .filter(
            (n: any) =>
              n.name.toLowerCase().includes(q) ||
              (n.methods || []).some((m: string) => m.toLowerCase().includes(q)),
          )
          .slice(0, 8);
  $: libraryResults = index && q ? searchIndex(index, q, 30) : [];
  $: installed = new Map($importedLibraries.map((l) => [l.name, l.version]));
  $: items = [
    ...blockResults.map((n: any) => ({ kind: "block" as const, node: n })),
    ...libraryResults.map((l) => ({ kind: "library" as const, lib: l })),
  ];
  $: if (active >= items.length) active = Math.max(0, items.length - 1);

  async function choose(i: number) {
    const item = items[i];
    if (!item) return;
    if (item.kind === "block") {
      dispatch("add", item.node);
      dispatch("close");
      return;
    }
    importing = item.lib.name;
    importError = "";
    try {
      const lib = await importLibrary(item.lib);
      if (lib.components.length === 0) throw new Error("No classes with public functions were found");
      addLibrary(lib);
      dispatch("add", lib.components[0]);
      dispatch("close");
    } catch (e: any) {
      importError = `${item.lib.name}: ${e?.message || e}`;
    } finally {
      importing = null;
    }
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") dispatch("close");
    else if (e.key === "ArrowDown") {
      active = Math.min(items.length - 1, active + 1);
      e.preventDefault();
      scrollActive();
    } else if (e.key === "ArrowUp") {
      active = Math.max(0, active - 1);
      e.preventDefault();
      scrollActive();
    } else if (e.key === "Enter") choose(active);
  }

  async function scrollActive() {
    await tick();
    document.querySelector(".cp .item.active")?.scrollIntoView({ block: "nearest" });
  }

  const kb = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} kB`);
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div class="backdrop" on:click|self={() => dispatch("close")}>
  <div class="cp" role="dialog" aria-label="Command palette">
    <div class="search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        ><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg
      >
      <input
        bind:this={input}
        bind:value={query}
        on:keydown={onKey}
        on:input={() => (active = 0)}
        placeholder={initialMode === "libraries"
          ? "Search the Arduino Library Manager…"
          : "Add a block or search Arduino libraries…"}
      />
      <kbd>esc</kbd>
    </div>

    <div class="results">
      {#if !q}
        <div class="hint">
          {#if initialMode === "all"}
            <p>Type to find a block, or a library from the
              <b>Arduino Library Manager</b>{index ? ` (${index.length.toLocaleString("en")} libraries)` : ""}.</p>
          {:else}
            <p>Search {index ? index.length.toLocaleString("en") + " " : ""}public Arduino libraries.</p>
          {/if}
          <p class="small">
            Importing downloads the library, verifies its SHA-256 checksum and turns the public classes of
            its headers into blocks. No AI is involved: the same version always yields the same blocks.
          </p>
        </div>
      {/if}

      {#if blockResults.length > 0}
        <div class="section">Blocks</div>
        {#each blockResults as node, i (paletteKey(node))}
          <button
            class="item"
            class:active={active === i}
            on:mouseenter={() => (active = i)}
            on:click={() => choose(i)}
          >
            <span class="dot" style="background: {categoryOf(node.extras.type).color}"></span>
            <span class="main">
              <span class="name">{node.name}</span>
              <span class="sub"
                >{categoryOf(node.extras.type).label}{node.extras.packageName
                  ? ` · ${node.extras.packageName} ${node.extras.version}`
                  : ""}</span
              >
            </span>
            <span class="action">Add to canvas ↵</span>
          </button>
        {/each}
      {/if}

      {#if q}
        <div class="section">
          Arduino libraries
          {#if !index && !indexError}<span class="loading">loading index…</span>{/if}
        </div>
        {#if indexError}
          <div class="error">{indexError}</div>
        {:else if index && libraryResults.length === 0}
          <div class="none">No library matches “{query}”.</div>
        {/if}
        {#each libraryResults as lib, j (lib.name)}
          {@const i = blockResults.length + j}
          <button
            class="item"
            class:active={active === i}
            disabled={!!importing}
            on:mouseenter={() => (active = i)}
            on:click={() => choose(i)}
          >
            <span class="dot lib"></span>
            <span class="main">
              <span class="name"
                >{lib.name} <span class="ver">{lib.version}</span>
                {#if installed.has(lib.name)}<span class="tag">imported</span>{/if}</span
              >
              <span class="sub">{lib.sentence}</span>
            </span>
            <span class="action">
              {#if importing === lib.name}
                <span class="spinner"></span> importing…
              {:else}
                {kb(lib.size)} · {installed.has(lib.name) ? "Re-import" : "Import"} ↵
              {/if}
            </span>
          </button>
        {/each}
      {/if}
    </div>

    {#if importError}
      <div class="footer error">{importError}</div>
    {:else}
      <div class="footer">
        <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
        <span><kbd>↵</kbd> add / import</span>
        <span><kbd>Ctrl</kbd><kbd>K</kbd> open</span>
      </div>
    {/if}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 12vh;
    background: #05070acc;
    backdrop-filter: blur(2px);
  }
  .cp {
    width: min(640px, calc(100vw - 32px));
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    background: var(--panel);
    border: 1px solid var(--border-strong);
    border-radius: 12px;
    box-shadow: 0 24px 64px #000000a0;
    overflow: hidden;
  }
  .search {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 14px;
    border-bottom: 1px solid var(--border);
  }
  .search svg {
    width: 18px;
    height: 18px;
    color: var(--text-3);
  }
  .search input {
    flex: 1;
    height: 52px;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text);
    font-size: 15px;
  }
  kbd {
    display: inline-block;
    min-width: 18px;
    padding: 1px 5px;
    margin-right: 2px;
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    color: var(--text-3);
    font-family: var(--font);
    font-size: 10px;
    text-align: center;
  }
  .results {
    flex: 1;
    overflow-y: auto;
    padding: 6px;
  }
  .hint {
    padding: 14px 12px;
    color: var(--text-2);
    line-height: 1.5;
  }
  .hint b {
    color: var(--text);
  }
  .hint .small {
    margin-top: 8px;
    font-size: 12px;
    color: var(--text-3);
  }
  .section {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 10px 4px;
    color: var(--text-3);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .loading {
    text-transform: none;
    letter-spacing: 0;
    font-weight: 400;
  }
  .item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 10px;
    border-radius: 7px;
    text-align: left;
  }
  .item.active {
    background: var(--raised);
  }
  .item:disabled {
    cursor: progress;
  }
  .dot {
    flex-shrink: 0;
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .dot.lib {
    background: var(--cat-component);
    border-radius: 2px;
  }
  .main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .name {
    color: var(--text);
    font-weight: 500;
  }
  .ver {
    color: var(--text-3);
    font-weight: 400;
    font-size: 12px;
  }
  .tag {
    margin-left: 4px;
    padding: 0 6px;
    border-radius: 8px;
    background: #4cc38a1f;
    color: var(--ok);
    font-size: 10px;
    font-weight: 600;
  }
  .sub {
    color: var(--text-3);
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .action {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--text-3);
    font-size: 11px;
    opacity: 0;
  }
  .item.active .action {
    opacity: 1;
  }
  .spinner {
    width: 12px;
    height: 12px;
    border: 2px solid var(--border-strong);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .none,
  .error {
    padding: 8px 12px;
    color: var(--text-3);
  }
  .error {
    color: var(--error);
  }
  .footer {
    display: flex;
    gap: 16px;
    padding: 8px 14px;
    border-top: 1px solid var(--border);
    color: var(--text-3);
    font-size: 11px;
  }
  .footer.error {
    color: var(--error);
  }
</style>
