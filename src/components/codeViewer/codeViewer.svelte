<script lang="ts">
  import Prism from "prismjs";
  import "prismjs/components/prism-c";
  import "prismjs/components/prism-cpp";
  import "prismjs/components/prism-arduino";
  import { createEventDispatcher, tick } from "svelte";
  import type { Problem, Severity } from "../../generator/problems";
  import type { Statement } from "../../generator/generate";
  import type { EditStatus } from "../../importer/sync";

  export let code: string = "";
  export let problems: Problem[] = [];
  export let fileName: string = "sketch";
  export let statements: Statement[] = [];
  export let hovered: number | null = null;

  const dispatch = createEventDispatcher<{
    focus: string;
    hover: number | null;
    startEdit: void;
    stopEdit: void;
    revert: void;
  }>();

  // #region Editing: the canvas follows the code
  /** Applies the code to the canvas (force: also when parts are skipped). */
  export let applyCode: (text: string, force: boolean) => EditStatus = () => ({ kind: "unchanged", code });
  /** Imports the libraries of #includes that no block provides. */
  export let importLibraries: (headers: string[], onStatus: (s: string) => void) => Promise<string[]> = async () => [];

  const TEMPLATE = "void setup() {\n    \n}\n\nvoid loop() {\n    \n}\n";

  let editing = false;
  let draft = "";
  let synced = ""; // generated code the draft was last in sync with
  let dirty = false; // typed since the last evaluation
  let status: EditStatus | null = null;
  let textarea: HTMLTextAreaElement;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let libraryStatus = "";

  async function startEdit() {
    editing = true;
    draft = code || TEMPLATE;
    synced = code;
    dirty = false;
    status = null;
    tab = "code";
    dispatch("startEdit");
    await tick();
    textarea?.focus();
    if (!code) {
      const at = TEMPLATE.indexOf("    ") + 4;
      textarea?.setSelectionRange(at, at);
    }
  }

  function stopEdit() {
    clearTimeout(timer);
    if (dirty || status?.kind === "blocked") {
      if (!confirm("Some of your edits are not on the canvas yet and will be lost. Stop editing?")) return;
    }
    editing = false;
    status = null;
    dispatch("stopEdit");
  }

  function revert() {
    if (!confirm("Undo every change made since you started editing?")) return;
    clearTimeout(timer);
    dirty = false;
    status = null;
    dispatch("revert");
    // the restored diagram's code arrives through the code prop
    synced = "\u0000";
  }

  function evaluate(force = false) {
    clearTimeout(timer);
    dirty = false;
    status = applyCode(draft, force);
    if (status.kind !== "blocked") synced = status.code;
  }

  function onInput() {
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(() => evaluate(), 450);
  }

  // Changes made on the canvas while editing replace a draft that is in sync.
  $: if (editing && code !== synced && !dirty && status?.kind !== "blocked") {
    draft = code || TEMPLATE;
    synced = code;
  }

  function insert(text: string) {
    // execCommand keeps the browser's undo history (Ctrl+Z)
    if (!document.execCommand("insertText", false, text)) {
      const { selectionStart: a, selectionEnd: b } = textarea;
      textarea.setRangeText(text, a, b, "end");
    }
    draft = textarea.value;
    onInput();
  }

  function onEditorKey(e: KeyboardEvent) {
    const { selectionStart: a, value } = textarea;
    const lineStart = value.lastIndexOf("\n", a - 1) + 1;
    const indent = value.slice(lineStart).match(/^[ \t]*/)![0];
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      insert("    ");
    } else if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const before = value.slice(lineStart, a).trimEnd();
      insert("\n" + indent + (before.endsWith("{") ? "    " : ""));
    } else if (e.key === "}" && value.slice(lineStart, a).trim() === "" && indent.length >= 4) {
      e.preventDefault();
      textarea.setSelectionRange(a - Math.min(4, a - lineStart), a);
      insert("}");
    } else if (e.key === "s" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      evaluate();
    }
  }

  function gotoLine(line: number) {
    if (!textarea || line < 1) return;
    const lines = draft.split("\n");
    const start = lines.slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0);
    textarea.focus();
    textarea.setSelectionRange(start, start + (lines[line - 1]?.length ?? 0));
    const box = textarea.closest(".code") as HTMLElement | null;
    if (box) box.scrollTop = Math.max(0, PAD_TOP + (line - 4) * LINE_HEIGHT);
  }

  async function importMissing(headers: string[]) {
    const failed = await importLibraries(headers, (s) => (libraryStatus = s));
    libraryStatus = failed.length ? `Could not import: ${failed.join("; ")}` : "";
    evaluate();
  }

  $: errorLines = status?.kind === "blocked" ? status.reasons.map((r) => r.line).filter((l) => l > 0) : [];
  // #endregion

  // line -> statement (innermost statement that produced the line)
  $: lineStatement = (() => {
    const map = new Map<number, number>();
    statements.forEach((s) => s.lines.forEach((l) => map.set(l, s.id)));
    return map;
  })();
  $: litLines = hovered === null ? [] : statements[hovered]?.lines ?? [];

  const LINE_HEIGHT = 20; // matches .code line-height (12.5px * 1.6)
  const PAD_TOP = 14;
  let lastLine = -1;
  function onCodeMove(e: MouseEvent) {
    if (editing) return;
    const el = e.currentTarget as HTMLElement;
    const y = e.clientY - el.getBoundingClientRect().top + el.scrollTop - PAD_TOP;
    const line = Math.floor(y / LINE_HEIGHT);
    if (line === lastLine) return;
    lastLine = line;
    dispatch("hover", lineStatement.get(line) ?? null);
  }
  function onCodeLeave() {
    lastLine = -1;
    dispatch("hover", null);
  }

  let tab: "code" | "problems" = "code";

  // Same message on several nodes is shown once, with all its nodes.
  $: uniqueProblems = problems.reduce(
    (acc, p) => {
      const found = acc.find((u) => u.message === p.message);
      if (found) {
        if (p.nodeId) found.nodes.push({ id: p.nodeId, name: p.nodeName });
      } else
        acc.push({
          message: p.message,
          severity: p.severity,
          nodes: p.nodeId ? [{ id: p.nodeId, name: p.nodeName }] : [],
        });
      return acc;
    },
    [] as { message: string; severity: Severity; nodes: { id: string; name?: string }[] }[],
  );
  // Errors first; otherwise keep the generator's (deterministic) order.
  $: sortedProblems = [...uniqueProblems].sort(
    (a, b) => Number(b.severity === "error") - Number(a.severity === "error"),
  );
  $: errorCount = problems.filter((p) => p.severity === "error").length;

  $: shown = editing ? draft : code;
  // a trailing newline keeps the last (empty) line as tall as the textarea's
  $: html = Prism.highlight(editing ? draft + "\n" : code, Prism.languages.arduino, "arduino");
  $: lineCount = editing ? draft.split("\n").length : code ? code.replace(/\n$/, "").split("\n").length : 0;

  let copied = false;
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(shown);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      copied = false;
    }
  }

  function download() {
    const blob = new Blob([shown], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${fileName}.ino`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
</script>

<section class="panel">
  <div class="tabs" role="tablist">
    <button role="tab" class:active={tab === "code"} on:click={() => (tab = "code")}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        ><path d="m8 6-6 6 6 6M16 6l6 6-6 6" /></svg
      >
      Code
    </button>
    <button
      role="tab"
      class:active={tab === "problems"}
      on:click={() => (tab = "problems")}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
        ><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17h.01" /></svg
      >
      Problems
      {#if problems.length > 0}<span class="count">{problems.length}</span>{/if}
    </button>
    <div class="spacer"></div>
    {#if tab === "code" && editing}
      <button class="ui-btn" on:click={revert} title="Undo every change made since you started editing">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          ><path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-15-6.7L3 13" /></svg
        >
        Revert
      </button>
      <button class="ui-btn primary" on:click={stopEdit} title="Stop editing">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          ><path d="m5 12 5 5L20 7" /></svg
        >
        Done
      </button>
    {:else if tab === "code"}
      <button
        class="ui-btn"
        on:click={startEdit}
        title="Edit the code; the canvas follows when the code can be expressed with blocks"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          ><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg
        >
        Edit
      </button>
      <button class="ui-btn" on:click={copyCode} disabled={!code} title="Copy to clipboard">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          ><rect x="9" y="9" width="12" height="12" rx="2" /><path
            d="M5 15V5a2 2 0 0 1 2-2h10"
          /></svg
        >
        {copied ? "Copied" : "Copy"}
      </button>
      <button class="ui-btn" on:click={download} disabled={!code} title="Download as .ino">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          ><path d="M12 3v12m0 0-5-5m5 5 5-5M4 21h16" /></svg
        >
        .ino
      </button>
    {/if}
  </div>

  {#if tab === "code"}
    {#if !code && !editing}
      <div class="empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          ><path d="m8 6-6 6 6 6M16 6l6 6-6 6" /></svg
        >
        The generated Arduino sketch will appear here
        <button class="ui-btn" on:click={startEdit}>…or write code to build the diagram</button>
      </div>
    {:else}
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="code" class:editing on:mousemove={onCodeMove} on:mouseleave={onCodeLeave}>
      <div class="marks" aria-hidden="true">
        {#if !editing}
          {#each litLines as l}<div class="mark" style="top: {PAD_TOP + l * LINE_HEIGHT}px"></div>{/each}
        {/if}
        {#each errorLines as l}<div class="mark error" style="top: {PAD_TOP + (l - 1) * LINE_HEIGHT}px"></div>{/each}
      </div>
      <div class="gutter" aria-hidden="true">
        {#each Array(lineCount) as _, i}<span class:bad={errorLines.includes(i + 1)}>{i + 1}</span>{/each}
      </div>
      <div class="editor">
        <pre class="language-arduino"><code>{@html html}</code></pre>
        {#if editing}
          <textarea
            bind:this={textarea}
            bind:value={draft}
            on:input={onInput}
            on:keydown={onEditorKey}
            spellcheck="false"
            autocomplete="off"
            autocapitalize="off"
            wrap="off"
            aria-label="Arduino code"
          ></textarea>
        {/if}
      </div>
    </div>
    {/if}
    {#if editing}
      <div class="edit-status {dirty ? 'typing' : status?.kind ?? 'idle'}">
        {#if dirty}
          <span class="spinner"></span> Reading the code…
        {:else if !status}
          Type to change the program; the canvas follows when the code can be expressed with blocks.
          <span class="keys"><kbd>Ctrl</kbd><kbd>S</kbd> apply now</span>
        {:else if status.kind === "unchanged"}
          ✓ The canvas matches the code
        {:else if status.kind === "applied"}
          ✓ Canvas updated{status.added || status.removed
            ? ` · ${status.added} block${status.added === 1 ? "" : "s"} added, ${status.removed} removed`
            : ""}
          {#if status.skipped.length}
            <span class="skipped">· {status.skipped.length} part{status.skipped.length > 1 ? "s" : ""} of the code {status.skipped.length > 1 ? "are" : "is"} not on the canvas</span>
          {/if}
        {:else}
          <div class="head">
            <b>Canvas not updated</b>
            <span class="actions">
              {#if status.missing.length}
                <button class="ui-btn" disabled={!!libraryStatus && !libraryStatus.startsWith("Could")} on:click={() => status?.kind === "blocked" && importMissing(status.missing)}
                  >Import {status.missing.join(", ")}</button
                >
              {/if}
              <button class="ui-btn" on:click={() => evaluate(true)} title="Update the canvas with the parts that can be expressed with blocks"
                >Apply the rest</button
              >
            </span>
          </div>
          {#if libraryStatus}<div class="lib">{libraryStatus}</div>{/if}
          <ul>
            {#each status.reasons.slice(0, 4) as r}
              <li>
                {#if r.line > 0}<button class="line" on:click={() => gotoLine(r.line)}>line {r.line}</button>{/if}
                {r.message}
              </li>
            {/each}
            {#if status.reasons.length > 4}<li class="more">and {status.reasons.length - 4} more</li>{/if}
          </ul>
        {/if}
      </div>
    {/if}
  {:else}
    <div class="problems">
      {#each sortedProblems as problem}
        <div class="problem" class:error={problem.severity === "error"}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            ><path d="M12 3 2 20h20L12 3Z" /><path d="M12 10v4M12 17h.01" /></svg
          >
          <div class="body">
            <div class="msg">
              <span class="sev">{problem.severity}</span>
              {problem.message}
            </div>
            {#if problem.nodes.length > 0}
              <div class="refs">
                {#each problem.nodes as node}
                  <button on:click={() => dispatch("focus", node.id)} title="Show on canvas"
                    >{node.name ?? "block"}</button
                  >
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {:else}
        <div class="empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            ><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></svg
          >
          No problems detected
        </div>
      {/each}
    </div>
  {/if}

  {#if tab === "code" && !editing && problems.length > 0}
    <button class="status warn" on:click={() => (tab = "problems")}>
      {#if errorCount > 0}
        {errorCount} error{errorCount > 1 ? "s" : ""}{problems.length > errorCount
          ? ` and ${problems.length - errorCount} warning${problems.length - errorCount > 1 ? "s" : ""}`
          : ""} in the model — the code is incomplete
      {:else}
        {problems.length} warning{problems.length > 1 ? "s" : ""} in the model
      {/if}
    </button>
  {/if}
</section>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-width: 0;
    background: var(--panel);
  }

  .tabs {
    display: flex;
    align-items: center;
    gap: 2px;
    height: 42px;
    padding: 0 8px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .tabs [role="tab"] {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 42px;
    padding: 0 10px;
    color: var(--text-3);
    font-weight: 500;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
  }
  .tabs [role="tab"] svg {
    width: 14px;
    height: 14px;
  }
  .tabs [role="tab"]:hover {
    color: var(--text-2);
  }
  .tabs [role="tab"].active {
    color: var(--text);
    border-bottom-color: var(--accent);
  }
  .count {
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: var(--warn);
    color: #1a1300;
    font-size: 11px;
    font-weight: 700;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .spacer {
    flex: 1;
  }
  .tabs .ui-btn {
    margin-left: 4px;
  }

  .code {
    position: relative;
    flex: 1;
    display: flex;
    overflow: auto;
    font-family: var(--mono);
    font-size: 12.5px;
    line-height: 20px;
    background: var(--bg);
  }
  .marks {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }
  .mark {
    position: absolute;
    left: 0;
    right: 0;
    height: 20px;
    background: #4f9dff1c;
    box-shadow: inset 2px 0 0 var(--accent);
  }
  .gutter {
    position: sticky;
    left: 0;
    display: flex;
    flex-direction: column;
    padding: 14px 10px 14px 14px;
    color: var(--text-3);
    text-align: right;
    user-select: none;
    background: var(--bg);
    opacity: 0.7;
  }
  .editor {
    position: relative;
    flex: 1;
    min-width: max-content;
  }
  pre,
  textarea {
    margin: 0;
    padding: 14px 16px 14px 6px;
    font: inherit;
    line-height: 20px;
    letter-spacing: 0;
    white-space: pre;
    tab-size: 4;
  }
  pre {
    min-height: 100%;
    color: var(--text);
  }
  /* same font as the gutter and the textarea, or the lines drift apart */
  pre code {
    font: inherit;
  }
  textarea {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
    outline: 0;
    resize: none;
    overflow: hidden;
    background: transparent;
    color: transparent;
    caret-color: var(--text);
  }
  textarea::selection {
    background: #4f9dff40;
    color: transparent;
  }
  .code.editing {
    box-shadow: inset 0 0 0 1px var(--accent-soft);
  }
  .code.editing .editor {
    cursor: text;
  }
  .mark.error {
    background: #ff6b6b1a;
    box-shadow: inset 2px 0 0 var(--error);
  }
  .gutter .bad {
    color: var(--error);
    opacity: 1;
  }

  .edit-status {
    flex-shrink: 0;
    padding: 8px 14px;
    border-top: 1px solid var(--border);
    font-size: 12px;
    color: var(--text-2);
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
  }
  .edit-status.unchanged,
  .edit-status.applied {
    color: var(--ok);
  }
  .edit-status .skipped {
    color: var(--warn);
  }
  .edit-status.blocked {
    display: block;
    background: var(--warn-soft);
    color: var(--text);
  }
  .edit-status .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 4px;
  }
  .edit-status .head b {
    color: var(--warn);
    font-weight: 600;
  }
  .edit-status .actions {
    display: flex;
    gap: 6px;
  }
  .edit-status ul {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .edit-status li {
    color: var(--text-2);
    line-height: 1.45;
  }
  .edit-status .line {
    margin-right: 4px;
    padding: 0 6px;
    border-radius: 8px;
    background: var(--raised);
    color: var(--text-2);
    font-family: var(--mono);
    font-size: 11px;
  }
  .edit-status .line:hover {
    background: var(--accent-soft);
    color: var(--accent);
  }
  .edit-status .more,
  .edit-status .lib {
    color: var(--text-3);
  }
  .edit-status .keys {
    margin-left: auto;
    color: var(--text-3);
  }
  kbd {
    display: inline-block;
    padding: 0 4px;
    margin-left: 2px;
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    font-family: var(--font);
    font-size: 10px;
  }
  .spinner {
    width: 11px;
    height: 11px;
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

  /* Prism tokens */
  .code :global(.token.comment) {
    color: #6f7787;
    font-style: italic;
  }
  .code :global(.token.keyword),
  .code :global(.token.directive) {
    color: #c792ea;
  }
  .code :global(.token.macro),
  .code :global(.token.property) {
    color: #c792ea;
  }
  .code :global(.token.function) {
    color: #82aaff;
  }
  .code :global(.token.number),
  .code :global(.token.constant),
  .code :global(.token.boolean) {
    color: #f78c6c;
  }
  .code :global(.token.string) {
    color: #c3e88d;
  }
  .code :global(.token.class-name),
  .code :global(.token.builtin) {
    color: #ffcb6b;
  }
  .code :global(.token.operator),
  .code :global(.token.punctuation) {
    color: #89ddff;
  }

  .problems {
    flex: 1;
    overflow: auto;
    padding: 8px;
  }
  .problem {
    display: flex;
    gap: 10px;
    padding: 10px;
    border-radius: var(--radius-sm);
  }
  .problem:hover {
    background: var(--panel-2);
  }
  .problem > svg {
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    color: var(--warn);
    margin-top: 1px;
  }
  .msg {
    color: var(--text);
    line-height: 1.45;
  }
  .sev {
    display: inline-block;
    margin-right: 4px;
    padding: 0 5px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    background: var(--warn-soft);
    color: var(--warn);
  }
  .problem.error .sev {
    background: #ff6b6b22;
    color: var(--error);
  }
  .problem.error > svg {
    color: var(--error);
  }
  .refs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 6px;
  }
  .refs button {
    padding: 1px 7px;
    border-radius: 10px;
    background: var(--raised);
    color: var(--text-2);
    font-size: 11px;
  }
  .refs button:hover {
    background: var(--accent-soft);
    color: var(--accent);
  }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 48px 16px;
    color: var(--text-3);
  }
  .empty svg {
    width: 28px;
    height: 28px;
    color: var(--ok);
  }
  .panel > .empty {
    flex: 1;
    justify-content: center;
    background: var(--bg);
  }
  .panel > .empty svg {
    color: var(--text-3);
  }

  .status {
    flex-shrink: 0;
    padding: 8px 14px;
    text-align: left;
    font-size: 12px;
    border-top: 1px solid var(--border);
  }
  .status.warn {
    background: var(--warn-soft);
    color: var(--warn);
  }
  .status.warn:hover {
    background: #f5b84a2e;
  }
</style>
