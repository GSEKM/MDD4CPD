// Indexed, read-only view of a diagram (Svelte Flow nodes and edges).
//
//   node   { id, position, data: { name, extras, handles[] } }
//   handle { id, edge (label), type: "source" | "target", index }
//   edge   { id, source, sourceHandle, target, targetHandle }
//
// Edge lists keep the order of the model (= link creation order), which is
// what gives statements their order in the generated code.

export type DNode = { id: string; position?: { x: number; y: number }; data: any };
export type DHandle = { id: string; edge: string; type: "source" | "target"; index: number };
export type DEdge = {
    id?: string;
    source: string;
    sourceHandle?: string | null;
    target: string;
    targetHandle?: string | null;
};
export type Port = { node: DNode; handle: DHandle; name: string };
export type Diagram = { nodes: DNode[]; edges: DEdge[] };

export const valueTypes = ["variable", "constant", "parameter", "port", "built-in-constant"];

export class Graph {
    readonly nodes: DNode[];
    readonly edges: DEdge[];
    private byId = new Map<string, DNode>();
    private outgoing = new Map<string, DEdge[]>();
    private incoming = new Map<string, DEdge[]>();

    constructor(model: Diagram) {
        // Copy: the generator must never mutate the editor's state.
        this.nodes = JSON.parse(JSON.stringify(model.nodes || []));
        this.edges = JSON.parse(JSON.stringify(model.edges || []));
        this.nodes.forEach((n) => this.byId.set(n.id, n));
        this.edges.forEach((e) => {
            push(this.outgoing, key(e.source, e.sourceHandle), e);
            push(this.incoming, key(e.target, e.targetHandle), e);
        });
    }

    node(id: string): DNode | undefined {
        return this.byId.get(id);
    }

    handles(node: DNode | undefined): DHandle[] {
        return node?.data?.handles || [];
    }

    port(nodeId: string, handleId: string | null | undefined): Port | null {
        const node = this.byId.get(nodeId);
        const handle = this.handles(node).find((h) => h.id === handleId);
        return node && handle ? { node, handle, name: handle.edge } : null;
    }

    findPort(node: DNode, label: string, type: "source" | "target"): Port | null {
        const handle = this.handles(node).find((h) => h.edge === label && h.type === type);
        return handle ? { node, handle, name: handle.edge } : null;
    }

    /** Edges leaving a source handle, in model order. */
    from(port: Port | null): DEdge[] {
        return port ? this.outgoing.get(key(port.node.id, port.handle.id)) || [] : [];
    }

    /** Edges entering a target handle, in model order. */
    to(port: Port | null): DEdge[] {
        return port ? this.incoming.get(key(port.node.id, port.handle.id)) || [] : [];
    }

    edgesOf(node: DNode): DEdge[] {
        return this.edges.filter((e) => e.source === node.id || e.target === node.id);
    }

    /** Value nodes pair in-k with out-k. */
    pairedOut(inPort: Port): Port | null {
        const handle = this.handles(inPort.node).find(
            (h) => h.type === "source" && h.index === inPort.handle.index,
        );
        return handle ? { node: inPort.node, handle, name: handle.edge } : null;
    }

    targetOf(edge: DEdge): Port | null {
        return this.port(edge.target, edge.targetHandle);
    }

    sourceOf(edge: DEdge): Port | null {
        return this.port(edge.source, edge.sourceHandle);
    }
}

// Helpers on node data
export const extras = (node: DNode | undefined): any => node?.data?.extras || {};
export const typeOf = (node: DNode | undefined): string | undefined => extras(node).type;
export const nameOf = (node: DNode | undefined): string => node?.data?.name ?? "";
export const isValue = (node: DNode | undefined) => valueTypes.includes(typeOf(node) ?? "");

function key(nodeId: string, handleId: string | null | undefined) {
    return `${nodeId}\u0000${handleId ?? ""}`;
}
function push<K, V>(map: Map<K, V[]>, k: K, v: V) {
    const list = map.get(k);
    if (list) list.push(v);
    else map.set(k, [v]);
}
