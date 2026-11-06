import { Position } from "@xyflow/svelte";

export interface HandleInfo {
    id: string;
    edge: string; // label; for methods, the full C signature
    index: number; // in-k on the left pairs with out-k on the right
    type: "source" | "target";
    position: Position;
    isConnectable: boolean;
}

export function addHandle(
    handles: HandleInfo[],
    edge: string,
    index: number,
    type: "source" | "target",
) {
    handles.push({
        id: `${type}-${index}`,
        edge,
        index,
        type,
        position: type === "source" ? Position.Right : Position.Left,
        isConnectable: true,
    });
}

/** Handles of a freshly dropped palette node (same order as the legacy tool). */
export function createHandles(d: any): HandleInfo[] {
    const handles: HandleInfo[] = [];
    let leftIndex = 0;
    let rightIndex = 0;
    d.outs?.forEach((e: string) => addHandle(handles, e, rightIndex++, "source"));
    d.ins?.forEach((e: string) => addHandle(handles, e, leftIndex++, "target"));
    d.methods?.forEach((e: string) => {
        addHandle(handles, e, rightIndex++, "source");
        addHandle(handles, e, leftIndex++, "target");
    });
    return handles;
}

/** Adds one usage (an extra in/out pair named "<base>-k") to a value node. */
export function withUsage(name: string, handles: HandleInfo[]): HandleInfo[] {
    const firstUsage = name === "Function" ? 1 : 0;
    const base = {
        left: handles.find((h) => h.type === "target" && h.index === firstUsage),
        right: handles.find((h) => h.type === "source" && h.index === firstUsage),
    };
    const count = handles.filter(
        (h) => h.type === "target" && base.left && h.edge.startsWith(base.left.edge),
    ).length;
    const next = [...handles];
    const index = Math.max(-1, ...handles.map((h) => h.index)) + 1;
    if (base.right) addHandle(next, `${base.right.edge}-${count}`, index, "source");
    if (base.left) addHandle(next, `${base.left.edge}-${count}`, index, "target");
    return next;
}

/** Splits "unsigned long millis(int a)" into its parts for display. */
export function splitSignature(sig: string): { ret: string; name: string; args: string } | null {
    const m = sig.match(/^\s*(.*?)\s*([A-Za-z_]\w*)\s*\((.*)\)\s*$/);
    if (!m) return null;
    return { ret: m[1], name: m[2], args: m[3] };
}
