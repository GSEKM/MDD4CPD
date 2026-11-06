// Example diagrams, built from the palette definitions in nodes.json.
import type { Edge, Node } from "@xyflow/svelte";
import { builtInPalette as palette } from "../palette";
import { createHandles, withUsage } from "./nodes/handles";

export type Diagram = { nodes: Node[]; edges: Edge[] };

let counter = 0;

/** Creates a node like a palette drop would, with optional extras and usages. */
export function makeNode(
    name: string,
    x: number,
    y: number,
    extras: Record<string, any> = {},
    usages = 0,
): Node {
    const def = palette.find((n: any) => n.name === name);
    if (!def) throw new Error(`Unknown palette node ${name}`);
    const data: any = JSON.parse(JSON.stringify(def));
    if (data.extras.type !== "controller") {
        data.extras.returnType = data.extras.returnType || "byte";
        if (data.extras.hasValue && data.extras.value === undefined) data.extras.value = "";
    }
    Object.assign(data.extras, extras);
    let handles = createHandles(data);
    for (let i = 0; i < usages; i++) handles = withUsage(name, handles);
    data.handles = handles;
    return { id: `ex-${Date.now()}-${counter++}`, type: "custom", position: { x, y }, data };
}

function handleId(node: Node, label: string, type: "source" | "target") {
    const h = (node.data as any).handles.find((h: any) => h.edge === label && h.type === type);
    if (!h) throw new Error(`No ${type} handle "${label}" on ${(node.data as any).name}`);
    return h.id;
}

/** Adds an edge between two handles, given by their labels. */
export function link(edges: Edge[], from: Node, fromLabel: string, to: Node, toLabel: string) {
    const sourceHandle = handleId(from, fromLabel, "source");
    const targetHandle = handleId(to, toLabel, "target");
    edges.push({
        id: `xy-edge__${from.id}${sourceHandle}-${to.id}${targetHandle}`,
        source: from.id,
        sourceHandle,
        target: to.id,
        targetHandle,
    });
}

function linker(edges: Edge[]) {
    return (from: Node, fromLabel: string, to: Node, toLabel: string) =>
        link(edges, from, fromLabel, to, toLabel);
}

function blink(): Diagram {
    const edges: Edge[] = [];
    const link = linker(edges);
    const uno = makeNode("Arduino Uno", 0, 200);
    const pin = makeNode("LED_BUILTIN", 230, 0, {}, 2);
    const output = makeNode("OUTPUT", 440, 0);
    const high = makeNode("HIGH", 440, 130);
    const low = makeNode("LOW", 440, 260);
    const ms = makeNode("Parameter(s)", 230, 400, { returnType: "int", value: "1000" }, 1);
    const io = makeNode("Digital I/O", 680, 60);
    const time = makeNode("Time", 680, 400);

    link(uno, "setup()", pin, "in");
    link(pin, "out", output, "in");
    link(output, "out", io, "void pinMode(int pin, int mode)");
    link(uno, "loop()", pin, "in-1");
    link(pin, "out-1", high, "in");
    link(high, "out", io, "void digitalWrite(int pin, int value)");
    link(uno, "loop()", ms, "in");
    link(ms, "out", time, "void delay(int ms)");
    link(uno, "loop()", pin, "in-2");
    link(pin, "out-2", low, "in");
    link(low, "out", io, "void digitalWrite(int pin, int value)");
    link(uno, "loop()", ms, "in-1");
    link(ms, "out-1", time, "void delay(int ms)");
    return { nodes: [uno, pin, output, high, low, ms, io, time], edges };
}

function servo(): Diagram {
    const edges: Edge[] = [];
    const link = linker(edges);
    const uno = makeNode("Arduino Uno", 0, 260);
    const port = makeNode("Port", 230, 0, { value: "9" });
    const angle = makeNode("Variable(s)", 230, 220, { returnType: "int", name: "angle", value: "90" }, 1);
    const limit = makeNode("Constant(s)", 540, 360, { returnType: "int", name: "limit", value: "100" });
    const cond = makeNode("Condition", 540, 600, { value: "<" });
    const fn = makeNode("Function", 230, 620, { value: "waitHalf" });
    const ms = makeNode("Parameter(s)", 540, 800, { returnType: "int", value: "500" });
    const srv = makeNode("Servo", 820, 0);
    const time = makeNode("Time", 840, 760);

    link(uno, "setup()", port, "in");
    link(port, "out", srv, "uint8_t attach(int pin)");
    link(uno, "loop()", angle, "in");
    link(angle, "out", srv, "void write(int value)");
    link(uno, "loop()", angle, "in-1");
    link(angle, "out-1", cond, "void set(T xValue)");
    link(limit, "out", cond, "void set(T yValue)");
    link(cond, "body", fn, "in");
    link(fn, "body", ms, "in");
    link(ms, "out", time, "void delay(int ms)");
    return { nodes: [uno, port, angle, limit, cond, fn, ms, srv, time], edges };
}

export const examples: { name: string; description: string; build: () => Diagram }[] = [
    { name: "Blink", description: "Toggle the built-in LED every second", build: blink },
    {
        name: "Servo and condition",
        description: "Component object, variable, constant, condition and function",
        build: servo,
    },
];
