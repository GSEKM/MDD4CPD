<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import { examples } from "./examples";

  export let nodeCount = 0;
  export let edgeCount = 0;
  export let problemCount = 0;
  export let controllerName: string | undefined = undefined;

  const dispatch = createEventDispatcher<{
    example: number;
    open: File;
    save: void;
    clear: void;
  }>();

  let menuOpen = false;
  let fileInput: HTMLInputElement;

  function onFile(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (file) dispatch("open", file);
    (e.currentTarget as HTMLInputElement).value = "";
  }

  function clickOutside(node: HTMLElement) {
    const handler = (e: MouseEvent) => {
      if (!node.contains(e.target as Node)) menuOpen = false;
    };
    document.addEventListener("mousedown", handler);
    return { destroy: () => document.removeEventListener("mousedown", handler) };
  }
</script>

<header>
  <div class="brand">
    <span class="logo">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        ><rect x="5" y="5" width="14" height="14" rx="2" /><path
          d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"
        /></svg
      >
    </span>
    <div>
      <div class="name">MDD4CPD</div>
      <div class="tag">Model-driven code for cyber-physical devices</div>
    </div>
  </div>

  <div class="actions">
    <div class="menu" use:clickOutside>
      <button class="ui-btn" on:click={() => (menuOpen = !menuOpen)} aria-expanded={menuOpen}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          ><path d="M4 19.5V5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2Z" /></svg
        >
        Examples
        <svg class="caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
          ><path d="m6 9 6 6 6-6" /></svg
        >
      </button>
      {#if menuOpen}
        <div class="dropdown">
          {#each examples as ex, i}
            <button
              on:click={() => {
                menuOpen = false;
                dispatch("example", i);
              }}
            >
              <span class="ex-name">{ex.name}</span>
              <span class="ex-desc">{ex.description}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
    <span class="sep"></span>
    <button class="ui-btn" on:click={() => fileInput.click()} title="Open a saved diagram (.json)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        ><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></svg
      >
      Open
    </button>
    <button
      class="ui-btn"
      on:click={() => dispatch("save")}
      disabled={nodeCount === 0}
      title="Save the diagram as .json"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        ><path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path
          d="M7 3v5h8M7 21v-7h10v7"
        /></svg
      >
      Save
    </button>
    <button
      class="ui-btn"
      on:click={() => dispatch("clear")}
      disabled={nodeCount === 0}
      title="Remove every block"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        ><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg
      >
      Clear
    </button>
    <input type="file" accept=".json,application/json" bind:this={fileInput} on:change={onFile} hidden />
  </div>

  <div class="status">
    {#if controllerName}
      <span class="chip">{controllerName}</span>
    {/if}
    <span class="meta">{nodeCount} blocks · {edgeCount} links</span>
    {#if nodeCount > 0}
      {#if problemCount === 0}
        <span class="chip ok"><i></i>Code ready</span>
      {:else}
        <span class="chip warn"><i></i>{problemCount} problem{problemCount > 1 ? "s" : ""}</span>
      {/if}
    {/if}
  </div>
</header>

<style>
  header {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 16px;
    height: 52px;
    padding: 0 14px;
    background: var(--panel);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 0;
  }
  .logo {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 7px;
    background: var(--accent-soft);
    color: var(--accent);
  }
  .logo svg {
    width: 18px;
    height: 18px;
  }
  .name {
    font-weight: 700;
    font-size: 14px;
    letter-spacing: 0.02em;
  }
  .tag {
    color: var(--text-3);
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .sep {
    width: 1px;
    height: 20px;
    background: var(--border);
    margin: 0 4px;
  }
  .caret {
    width: 12px !important;
    height: 12px !important;
    margin-left: -2px;
  }

  .menu {
    position: relative;
  }
  .dropdown {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 50;
    min-width: 260px;
    padding: 4px;
    background: var(--panel-2);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    box-shadow: 0 12px 32px #00000080;
  }
  .dropdown button {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    padding: 8px 10px;
    border-radius: var(--radius-sm);
    text-align: left;
  }
  .dropdown button:hover {
    background: var(--raised);
  }
  .ex-name {
    font-weight: 600;
    color: var(--text);
  }
  .ex-desc {
    color: var(--text-3);
    font-size: 11px;
  }

  .status {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    min-width: 0;
  }
  .meta {
    color: var(--text-3);
    font-size: 12px;
    white-space: nowrap;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 24px;
    padding: 0 9px;
    border-radius: 12px;
    background: var(--raised);
    color: var(--text-2);
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
  }
  .chip i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
  }
  .chip.ok {
    background: #4cc38a1f;
    color: var(--ok);
  }
  .chip.warn {
    background: var(--warn-soft);
    color: var(--warn);
  }
</style>
