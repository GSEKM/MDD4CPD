<script lang="ts">
  // Link renderer. Colours a link by its role in the generated code, numbers
  // the first link of every statement with its position in the block, offers
  // reordering, and highlights the whole statement chain on hover.
  import { EdgeLabelRenderer, type EdgeProps } from "@xyflow/svelte";
  import { edges, hoveredStatement, linkInfo, nodes } from "../code/store";
  import { categoryOf } from "../categories";

  type $$Props = EdgeProps;
  export let id: string;
  export let source: string;
  export let target: string;
  export let sourceX: number;
  export let sourceY: number;
  export let targetX: number;
  export let targetY: number;
  export let selected: boolean = false;
  export let sourceHandleId: string | null | undefined = undefined;
  $$restProps;

  // Same bezier as Svelte Flow's default (right -> left), computed here so the
  // order badge can sit on the curve.
  $: offset = Math.max(Math.abs(targetX - sourceX) / 2, 40);
  $: c1 = { x: sourceX + offset, y: sourceY };
  $: c2 = { x: targetX - offset, y: targetY };
  $: path = `M ${sourceX},${sourceY} C ${c1.x},${c1.y} ${c2.x},${c2.y} ${targetX},${targetY}`;
  function at(t: number) {
    const u = 1 - t;
    return {
      x: u * u * u * sourceX + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * targetX,
      y: u * u * u * sourceY + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * targetY,
    };
  }

  $: info = $linkInfo.get(id);
  $: sourceNode = $nodes.find((n) => n.id === source);
  $: sourceType = (sourceNode?.data as any)?.extras?.type;
  $: role = !info
    ? "operand"
    : !info.first
      ? "argument"
      : sourceType === "controller"
        ? "lifecycle"
        : "branch";
  $: color =
    role === "lifecycle"
      ? categoryOf("controller").color
      : role === "branch"
        ? categoryOf("logic").color
        : role === "argument"
          ? categoryOf("port").color
          : "var(--text-3)";
  $: lit = info && $hoveredStatement === info.statement.id;
  $: dim = $hoveredStatement !== null && !lit;
  // Near the target end: links fanning out of one handle all start at the same
  // point but enter different handles, so badges do not pile up.
  $: badge = info?.first
    ? at(1 - Math.min(0.35, 34 / Math.max(1, Math.hypot(targetX - sourceX, targetY - sourceY))))
    : null;

  /** Siblings: links leaving the same handle, in model (= statement) order. */
  $: siblings = $edges.filter((e) => e.source === source && e.sourceHandle === sourceHandleId);
  $: index = siblings.findIndex((e) => e.id === id);

  function move(delta: number) {
    const other = siblings[index + delta];
    if (!other) return;
    edges.update((list) => {
      const a = list.findIndex((e) => e.id === id);
      const b = list.findIndex((e) => e.id === other.id);
      const next = [...list];
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });
  }

  const enter = () => info && hoveredStatement.set(info.statement.id);
  const leave = () => hoveredStatement.set(null);
</script>

<g class="flow-edge {role}" class:lit class:dim class:selected style="--edge: {color}">
  <path class="line" d={path} fill="none" />
  <!-- wide invisible path to make the link easy to hover and select -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <path class="hit" d={path} fill="none" on:mouseenter={enter} on:mouseleave={leave} />
</g>

{#if badge && info}
  <EdgeLabelRenderer>
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div
      class="badge nodrag nopan"
      class:lit
      class:dim
      class:open={selected || lit}
      style="--edge: {color}; transform: translate(-50%, -50%) translate({badge.x}px, {badge.y}px)"
      on:mouseenter={enter}
      on:mouseleave={leave}
      title="Statement {info.statement.order} of this block — use ‹ › to reorder"
    >
      {#if selected || lit}
        <button on:click|stopPropagation={() => move(-1)} disabled={index <= 0} title="Run earlier">‹</button>
      {/if}
      <span>{info.statement.order}</span>
      {#if selected || lit}
        <button
          on:click|stopPropagation={() => move(1)}
          disabled={index >= siblings.length - 1}
          title="Run later">›</button
        >
      {/if}
    </div>
  </EdgeLabelRenderer>
{/if}

<style>
  .line {
    stroke: var(--edge);
    stroke-width: 1.7;
    opacity: 0.75;
    transition: opacity 0.12s, stroke-width 0.12s;
  }
  .argument .line {
    stroke-dasharray: 5 4;
  }
  .operand .line {
    stroke-dasharray: 2 4;
  }
  .hit {
    stroke: transparent;
    stroke-width: 16;
    pointer-events: stroke;
  }
  .lit .line,
  .selected .line {
    opacity: 1;
    stroke-width: 2.6;
  }
  .lit .line {
    filter: drop-shadow(0 0 4px var(--edge));
  }
  .dim .line {
    opacity: 0.15;
  }

  .badge {
    position: absolute;
    pointer-events: all;
    display: flex;
    align-items: center;
    gap: 1px;
    height: 18px;
    min-width: 18px;
    padding: 0 4px;
    border-radius: 9px;
    background: var(--panel);
    border: 1.5px solid var(--edge);
    color: var(--text);
    font-size: 10.5px;
    font-weight: 700;
    line-height: 1;
    justify-content: center;
    transition: opacity 0.12s;
    cursor: default;
  }
  .badge.lit {
    background: var(--edge);
    color: #0f1115;
  }
  .badge.dim {
    opacity: 0.25;
  }
  .badge button {
    width: 14px;
    height: 14px;
    border-radius: 7px;
    color: inherit;
    font-size: 13px;
    line-height: 12px;
  }
  .badge button:hover:not(:disabled) {
    background: #00000033;
  }
  .badge button:disabled {
    opacity: 0.3;
  }
</style>
