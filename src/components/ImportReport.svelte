<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import type { SketchImport } from "../importer/ino";
  import { findLibraryForHeader, importLibrary, loadIndex } from "../libraries/importer";
  import { addLibrary } from "../libraries/store";

  export let fileName: string;
  export let result: SketchImport;

  const dispatch = createEventDispatcher<{ close: void; retry: void }>();

  $: warnings = result.notes.filter((n) => n.severity === "warning");
  $: infos = result.notes.filter((n) => n.severity === "info");
  $: blocks = result.diagram.nodes.length;
  $: links = result.diagram.edges.length;

  let showInfo = false;
  let busy = false;
  let status = "";

  async function importMissing() {
    busy = true;
    status = "Loading the Arduino library index…";
    const failed: string[] = [];
    try {
      const index = await loadIndex();
      for (const header of result.missingIncludes) {
        const lib = findLibraryForHeader(index, header);
        if (!lib) {
          failed.push(`${header} (no library provides it)`);
          continue;
        }
        status = `Importing ${lib.name} ${lib.version} for ${header}…`;
        try {
          const imported = await importLibrary(lib);
          if (!imported.components.some((c) => c.extras.library === header))
            failed.push(`${lib.name} ${lib.version} does not provide ${header}`);
          addLibrary(imported);
        } catch (e: any) {
          failed.push(`${header}: ${e?.message || e}`);
        }
      }
    } catch (e: any) {
      failed.push(e?.message || String(e));
    }
    busy = false;
    status = failed.length ? `Could not import: ${failed.join("; ")}` : "";
    dispatch("retry");
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
<div class="backdrop" on:click|self={() => !busy && dispatch("close")}>
  <div class="dialog" role="dialog" aria-label="Sketch import report">
    <header>
      <div>
        <div class="title">Imported {fileName}</div>
        <div class="meta">{blocks} blocks · {links} links · converted without AI, by fixed rules</div>
      </div>
      <button class="x" on:click={() => dispatch("close")} disabled={busy} title="Close">×</button>
    </header>

    <div class="body">
      {#if result.missingIncludes.length > 0}
        <section class="missing">
          <h3>Libraries not in the palette</h3>
          <p>
            Calls on objects of these libraries could not be mapped:
            {#each result.missingIncludes as h, i}<code>{h}</code>{i < result.missingIncludes.length - 1 ? ", " : ""}{/each}.
          </p>
          <button class="ui-btn primary" on:click={importMissing} disabled={busy}>
            {busy ? status : "Import them from the Library Manager and retry"}
          </button>
          {#if !busy && status}<p class="err">{status}</p>{/if}
        </section>
      {/if}

      {#if warnings.length > 0}
        <section>
          <h3>Skipped ({warnings.length})</h3>
          <ul>
            {#each warnings as n}
              <li><span class="line">line {n.line}</span>{n.message}</li>
            {/each}
          </ul>
        </section>
      {:else if result.missingIncludes.length === 0}
        <p class="ok">Everything in the sketch was converted.</p>
      {/if}

      {#if infos.length > 0}
        <section>
          <button class="toggle" on:click={() => (showInfo = !showInfo)}>
            {showInfo ? "▾" : "▸"} Notes ({infos.length})
          </button>
          {#if showInfo}
            <ul class="info">
              {#each infos as n}
                <li><span class="line">line {n.line}</span>{n.message}</li>
              {/each}
            </ul>
          {/if}
        </section>
      {/if}
    </div>

    <footer>
      <button class="ui-btn" on:click={() => dispatch("close")} disabled={busy}>Done</button>
    </footer>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 12vh;
    background: #05070acc;
  }
  .dialog {
    width: min(620px, calc(100vw - 32px));
    max-height: 72vh;
    display: flex;
    flex-direction: column;
    background: var(--panel);
    border: 1px solid var(--border-strong);
    border-radius: 12px;
    box-shadow: 0 24px 64px #000000a0;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 16px 18px 12px;
    border-bottom: 1px solid var(--border);
  }
  .title {
    font-size: 15px;
    font-weight: 600;
  }
  .meta {
    color: var(--text-3);
    font-size: 12px;
    margin-top: 2px;
  }
  .x {
    color: var(--text-3);
    font-size: 20px;
    line-height: 1;
  }
  .body {
    flex: 1;
    overflow-y: auto;
    padding: 12px 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  h3 {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--text-3);
    margin-bottom: 6px;
  }
  .missing {
    padding: 12px;
    border-radius: var(--radius);
    background: var(--warn-soft);
    border: 1px solid #f5b84a40;
  }
  .missing p {
    color: var(--text-2);
    margin-bottom: 10px;
    line-height: 1.5;
  }
  code {
    font-family: var(--mono);
    color: var(--warn);
  }
  ul {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  li {
    display: flex;
    gap: 10px;
    line-height: 1.45;
    color: var(--text);
  }
  .info li {
    color: var(--text-2);
  }
  .line {
    flex-shrink: 0;
    min-width: 52px;
    color: var(--text-3);
    font-family: var(--mono);
    font-size: 11px;
    padding-top: 1px;
  }
  .ok {
    color: var(--ok);
  }
  .err {
    color: var(--error);
    margin: 8px 0 0 !important;
  }
  .toggle {
    color: var(--text-2);
    font-size: 12px;
  }
  footer {
    display: flex;
    justify-content: flex-end;
    padding: 10px 18px 14px;
    border-top: 1px solid var(--border);
  }
</style>
