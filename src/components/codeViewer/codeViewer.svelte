<script lang="ts">
  import Prism from "prismjs";
  import "prismjs/components/prism-c";
  import "prismjs/components/prism-cpp";
  import "prismjs/components/prism-arduino";
  import { createEventDispatcher } from "svelte";
  import type { Problem, Severity } from "../../generator/problems";
  import type { Statement } from "../../generator/generate";

  export let code: string = "";
  export let problems: Problem[] = [];
  export let fileName: string = "sketch";
  export let statements: Statement[] = [];
  export let hovered: number | null = null;

  const dispatch = createEventDispatcher<{ focus: string; hover: number | null }>();

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

  $: html = Prism.highlight(code, Prism.languages.arduino, "arduino");
  $: lineCount = code ? code.replace(/\n$/, "").split("\n").length : 0;

  let copied = false;
  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      copied = true;
      setTimeout(() => (copied = false), 1500);
    } catch {
      copied = false;
    }
  }

  function download() {
    const blob = new Blob([code], { type: "text/plain" });
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
    {#if tab === "code"}
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
    {#if !code}
      <div class="empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          ><path d="m8 6-6 6 6 6M16 6l6 6-6 6" /></svg
        >
        The generated Arduino sketch will appear here
      </div>
    {:else}
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="code" on:mousemove={onCodeMove} on:mouseleave={onCodeLeave}>
      <div class="marks" aria-hidden="true">
        {#each litLines as l}<div class="mark" style="top: {PAD_TOP + l * LINE_HEIGHT}px"></div>{/each}
      </div>
      <div class="gutter" aria-hidden="true">
        {#each Array(lineCount) as _, i}<span>{i + 1}</span>{/each}
      </div>
      <pre class="language-arduino"><code>{@html html}</code></pre>
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

  {#if tab === "code" && problems.length > 0}
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
  pre {
    flex: 1;
    margin: 0;
    padding: 14px 16px 14px 6px;
    color: var(--text);
    white-space: pre;
    tab-size: 4;
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
