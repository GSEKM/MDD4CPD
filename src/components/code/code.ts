// Arduino code generator for the MDD4CPD diagram.
//
// Port of the generator of the original React tool (rzfzr/MDD4CPD-Legacy,
// src/components/Code.tsx) onto the Svelte Flow data model:
//   - a node is { id, position, data: { name, extras, handles[] } }
//   - a handle is { id, edge (its label), type: "source" | "target", index }
//   - an edge is { source, sourceHandle, target, targetHandle }
//
// Semantics (unchanged from the legacy tool):
//   - every out-handle of the micro-controller (setup(), loop()) becomes a
//     lifecycle method; each edge leaving it becomes one statement;
//   - an edge may pass through a chain of value nodes (Port, Parameter(s),
//     Variable(s), Constant(s), built-in constants) before reaching a method
//     handle; the values met on the way become the call's arguments;
//   - value nodes pair their in/out handles by index (in-k <-> out-k);
//   - statements follow the order in which the links were created.

export type Problem = { message: string; node?: any; port?: any };
export type GenerationResult = { code: string; problems: Problem[] };

// Longest/most specific first, as matching is done with startsWith.
const returnTypes = [
    "unsigned long",
    "unsigned int",
    "uint32_t",
    "uint16_t",
    "uint8_t",
    "int32_t",
    "int16_t",
    "boolean",
    "String",
    "string",
    "byte",
    "long",
    "int",
    "bool",
    "float",
    "double",
    "char",
];
const ordinals = [
    "first",
    "second",
    "third",
    "fourth",
    "fifth",
    "sixth",
    "seventh",
    "eighth",
    "ninth",
    "tenth",
    "eleventh",
];

export const paramTypes = [
    "variable",
    "constant",
    "parameter",
    "port",
    "built-in-constant",
];

type Port = { node: any; handle: any; name: string };

/** "unsigned long millis()" -> "millis", "Stepper(int, int)" -> "Stepper" */
function methodName(signature: string): string {
    const match = signature.match(/([A-Za-z_]\w*)\s*\(/);
    if (match) return match[1];
    return signature.trim().split(/\s+/).pop() || signature;
}

/** "void pinMode(int pin, int mode)" -> ["int pin", "int mode"] */
function expectedParameters(signature: string): string[] {
    const open = signature.indexOf("(");
    const close = signature.lastIndexOf(")");
    if (open === -1 || close === -1) return [];
    return signature
        .substring(open + 1, close)
        .split(",")
        .map((x) => x.trim())
        .filter((x) => x !== "" && x !== "void");
}

export function generateCode(model: { nodes: any[]; edges: any[] }): GenerationResult {
    // Work on a copy: the generator annotates nodes (instance names, ...).
    const nodes: any[] = JSON.parse(JSON.stringify(model.nodes || []));
    const edges: any[] = JSON.parse(JSON.stringify(model.edges || []));

    let code = "";
    const problems: Problem[] = [];

    // #region Model helpers
    const extras = (node: any) => node?.data?.extras || {};
    const typeOf = (node: any) => extras(node).type;
    const nameOf = (node: any) => node?.data?.name;
    const handlesOf = (node: any): any[] => node?.data?.handles || [];

    function getNode(nodeID: string) {
        return nodes.find((n) => n.id === nodeID);
    }
    function getPort(nodeID: string, handleID: string | null | undefined): Port | null {
        const node = getNode(nodeID);
        const handle = handlesOf(node).find((h) => h.id === handleID);
        if (!node || !handle) return null;
        return { node, handle, name: handle.edge };
    }
    function findPort(node: any, name: string, type: "source" | "target"): Port | null {
        const handle = handlesOf(node).find((h) => h.edge === name && h.type === type);
        return handle ? { node, handle, name: handle.edge } : null;
    }
    function edgesFrom(port: Port | null): any[] {
        if (!port) return [];
        return edges.filter(
            (e) => e.source === port.node.id && e.sourceHandle === port.handle.id
        );
    }
    function edgesTo(port: Port | null): any[] {
        if (!port) return [];
        return edges.filter(
            (e) => e.target === port.node.id && e.targetHandle === port.handle.id
        );
    }
    function edgesOf(node: any): any[] {
        return edges.filter((e) => e.source === node.id || e.target === node.id);
    }
    /** Value nodes pair in-k with out-k. */
    function getOutPort(inPort: Port): Port | null {
        const handle = handlesOf(inPort.node).find(
            (h) => h.type === "source" && h.index === inPort.handle.index
        );
        return handle ? { node: inPort.node, handle, name: handle.edge } : null;
    }
    function valuesOf(param: any): string[] {
        if (typeOf(param) === "built-in-constant") return [nameOf(param)];
        return String(extras(param).value ?? "")
            .split(",")
            .map((v) => v.trim());
    }
    function formattedParameters(params: any[]): string {
        return params
            .map((par) => {
                switch (typeOf(par)) {
                    case "parameter":
                    case "port":
                        return extras(par).value;
                    case "constant":
                    case "variable":
                        return extras(par).name;
                    case "built-in-constant":
                        return nameOf(par);
                    default:
                        return "/* error on node type */";
                }
            })
            .join(", ");
    }
    function add(...message: string[]) {
        code += message.join("") + "\n";
    }
    function warn(message: string, node: any = null, port: any = null) {
        problems.push({ message, node, port });
    }
    // #endregion

    // #region Shared variables
    const controllers = nodes.filter((n) => typeOf(n) === "controller");
    const controller = controllers[0];
    const logics = nodes.filter((n) => typeOf(n) === "logic");
    const components: any[] = [];
    nodes
        .filter((n) => typeOf(n) === "component")
        .forEach((node) => {
            const base = nameOf(node).toLowerCase().replace(/[^a-z0-9_]/g, "");
            node.instance = base + components.filter((c) => nameOf(c) === nameOf(node)).length;
            components.push(node);
        });
    const constants = nodes
        .filter((n) => typeOf(n) === "constant")
        .map((c) => {
            c.data.extras.name = String(c.data.extras.name || "con").toUpperCase();
            return c;
        });
    const variables = nodes.filter((n) => typeOf(n) === "variable");
    const usedDigital = nodes.filter((n) => extras(n).portType === "Digital");
    const usedAnalog = nodes.filter((n) => extras(n).portType === "Analog");
    const declaredFunctions = new Set<string>();
    let depth = 0;
    // #endregion

    // #region Warnings
    function warnAboutNumberOfControllers() {
        if (controllers.length === 0) warn("No micro-controller");
        if (controllers.length > 1)
            controllers.forEach((c) => warn("More than one micro-controller", c));
    }
    function warnAboutPortUsage() {
        usedDigital.forEach((port) => {
            if (Number(extras(port).value) >= extras(controller).digitalPorts)
                warn(`This ${nameOf(port)} does not exist on this micro-controller`, port);
        });
        usedAnalog.forEach((port) => {
            if (Number(extras(port).value) >= extras(controller).analogPorts)
                warn(`This ${nameOf(port)} does not exist on this micro-controller`, port);
        });
    }
    function warnAboutNodesWithoutEdges() {
        nodes.forEach((node) => {
            if (edgesOf(node).length === 0) warn("This component has no links", node);
        });
    }
    function warnAboutMultipleUsePorts() {
        nodes
            .filter((n) => paramTypes.includes(typeOf(n)))
            .forEach((node) => {
                handlesOf(node)
                    .filter((h) => h.type === "source" && h.edge.startsWith("out"))
                    .forEach((h) => {
                        const port = { node, handle: h, name: h.edge };
                        const count = edgesFrom(port).length;
                        if (count > 1) {
                            warn(
                                `This ${nameOf(node).toLowerCase()} has more than one link in the same ${h.edge} port.`,
                                node,
                                port
                            );
                        } else if (count === 0) {
                            warn(`This ${nameOf(node).toLowerCase()} is not being used.`, node, port);
                        }
                    });
            });
    }
    function warnAboutLooseEdges() {
        edges.forEach((edge) => {
            if (!getPort(edge.source, edge.sourceHandle) || !getPort(edge.target, edge.targetHandle))
                warn("Loose link", getNode(edge.source));
        });
    }
    function warnAboutExpectedVersusReceived(
        port: Port,
        expected: string[],
        received: string[]
    ) {
        const expMin = expected.filter((e) => !e.includes("=")).length;
        const expMax = expected.length;
        if (received.length < expMin || received.length > expMax) {
            const count = expMin === expMax ? expMin : `${expMin} to ${expMax}`;
            warn(
                `The function call "${port.name}" is receiving ${received.length} parameters instead of the expected ${count}`,
                port.node,
                port
            );
            return "error";
        }
        return "ok";
    }
    // #endregion

    // #region Declarations
    function addHeaderComments() {
        const uniqueDigitals = [...new Set(usedDigital.map((u) => extras(u).value))];
        const uniqueAnalogs = [...new Set(usedAnalog.map((u) => extras(u).value))];
        add("/* Code generated for ", nameOf(controller) ?? "(no micro-controller)");
        add(
            `Analog ports ${uniqueAnalogs.length}/${extras(controller).analogPorts ?? "?"}`,
            uniqueAnalogs.length > 0 ? ` (${uniqueAnalogs.join(", ")})` : ""
        );
        add(
            `Digital ports ${uniqueDigitals.length}/${extras(controller).digitalPorts ?? "?"}`,
            uniqueDigitals.length > 0 ? ` (${uniqueDigitals.join(", ")})` : "",
            " */"
        );
    }
    function addLibraries() {
        const libraries = [
            ...new Set(components.map((c) => extras(c).library).filter(Boolean)),
        ];
        if (libraries.length > 0) {
            add("");
            add("// Libraries");
            libraries.forEach((lib) => add("#include <" + lib + ">"));
        }
        if (components.length > 0) {
            add("");
            add("// Objects");
            components.forEach((comp) =>
                add(`${extras(comp).className || nameOf(comp)} ${comp.instance};`)
            );
        }
    }
    function declaration(node: any, name: string) {
        let values = valuesOf(node);
        const isArray = values.length > 1;
        const count = isArray ? "[" + values.length + "]" : "";
        const value = isArray ? "{" + values.join(", ") + "}" : values[0];
        const returnType = extras(node).returnType || "byte";
        return { returnType, name: name + count, value };
    }
    function addConstantDeclarations() {
        if (constants.length === 0) return;
        add("");
        add("// Constants");
        constants.forEach((c) => {
            const d = declaration(c, extras(c).name);
            add(`const ${d.returnType} ${d.name} = ${d.value};`);
        });
    }
    function addVariableDeclarations() {
        if (variables.length === 0) return;
        add("");
        add("// Variables");
        variables.forEach((v) => {
            const d = declaration(v, extras(v).name || "var");
            add(`${d.returnType} ${d.name}${d.value !== "" ? " = " + d.value : ""};`);
        });
    }
    function addFunctionDeclarations() {
        const functions = logics.filter((l) => nameOf(l) === "Function");
        if (functions.length === 0) return;
        add("");
        add("// Functions");
        functions.forEach(declareFunction);
    }
    function declareFunction(logic: any) {
        const name = String(extras(logic).value || "foo").replace(/\s/g, "");
        if (declaredFunctions.has(name)) return;
        declaredFunctions.add(name);
        add(`${extras(logic).returnType || "void"} ${name}() {`);
        edgesFrom(findPort(logic, "body", "source"))
            .forEach(processLink);
        add("}");
    }
    function addLifecycleMethods() {
        if (!controller) return;
        add("");
        add(`// Micro-controller's Lifecycle`);
        handlesOf(controller)
            .filter((h) => h.type === "source")
            .forEach((h) => {
                add("void ", h.edge, " {");
                edgesFrom({ node: controller, handle: h, name: h.edge })
                    .forEach(processLink);
                add("}");
                add("");
            });
    }
    // #endregion

    // #region Statements
    /** Follows a chain of value nodes, collecting them as call parameters. */
    function resolveTarget(toPort: Port, params: any[]): Port | null {
        if (!paramTypes.includes(typeOf(toPort.node))) return toPort;
        if (toPort.name.startsWith("void setValue")) return toPort; // assignment
        params.push(toPort.node);
        const nextFromPort = getOutPort(toPort);
        const nextLink = edgesFrom(nextFromPort)[0];
        if (!nextLink) return null;
        const nextToPort = getPort(nextLink.target, nextLink.targetHandle);
        if (!nextToPort) return null;
        if (params.includes(nextToPort.node)) return null; // cycle
        return resolveTarget(nextToPort, params);
    }

    /** Value used in a condition/loop input (the node feeding that input). */
    function getConditionalValue(node: any, portName: string): string {
        const link = edgesTo(findPort(node, portName, "target"))[0];
        if (!link) return "/* Lacking Value */";
        const port = getPort(link.source, link.sourceHandle);
        if (!port) return "/* Lacking Value */";
        const parent = port.node;
        if (paramTypes.includes(typeOf(parent))) return formattedParameters([parent]);
        if (typeOf(parent) === "component")
            return `${parent.instance}.${methodName(port.name)}()`;
        if (typeOf(parent) === "built-in") return `${methodName(port.name)}()`;
        return "/* Unknown value type */";
    }

    function addBlock(node: any, outName: string) {
        const outgoing = edgesFrom(findPort(node, outName, "source"));
        outgoing.forEach(processLink);
        return outgoing.length;
    }

    function callWithParameters(port: Port, params: any[], fromPort: Port) {
        const node = port.node;
        const fromNode = fromPort.node;

        if (nameOf(node) === "Function" && port.name === "declare") {
            // Functions are always declared globally, see addFunctionDeclarations.
            return;
        }

        const expected = expectedParameters(port.name);
        const received: string[] = [];
        params.forEach((p) => {
            const returnType = extras(p).returnType || "byte";
            received.push(...valuesOf(p).map((v) => returnType + " " + v));
        });

        if (typeOf(node) !== "logic") {
            if (warnAboutExpectedVersusReceived(port, expected, received) === "error") return;

            expected.forEach((ex, index) => {
                const re = received[index];
                if (ex.includes("=") && !re) return; // uses default value
                const expectedType = returnTypes.find((rt) => ex.startsWith(rt));
                const receivedType = returnTypes.find((rt) => re?.startsWith(rt));
                if (expectedType && expectedType !== receivedType) {
                    warn(
                        `The function call "${port.name}" expects its ${ordinals[index]} parameter to be of type "${expectedType}", received "${receivedType}" instead`,
                        node,
                        port
                    );
                }
            });
        }

        if (node.instance) {
            add(`${node.instance}.${methodName(port.name)}(${formattedParameters(params)});`);
        } else if (fromNode.instance) {
            add(`${fromNode.instance}.${methodName(fromPort.name)}();`);
        } else if (port.name.startsWith("void setValue")) {
            add(`${extras(node).name} = ${formattedParameters(params)};`);
        } else if (typeOf(node) === "built-in") {
            add(`${methodName(port.name)}(${formattedParameters(params)});`);
        } else if (typeOf(node) === "logic") {
            if (nameOf(node) === "Function") {
                add(String(extras(node).value || "foo").replace(/\s/g, "") + "();");
            } else if (nameOf(node) === "Condition") {
                const xValue = getConditionalValue(node, "void set(T xValue)");
                const yValue = getConditionalValue(node, "void set(T yValue)");
                add(`if (${xValue} ${extras(node).value} ${yValue}) {`);
                if (addBlock(node, "body") === 0)
                    add("/* Lacking code to be executed if conditional is true */");
                if (edgesFrom(findPort(node, "else", "source")).length > 0) {
                    add("} else {");
                    addBlock(node, "else");
                }
                add("}");
            } else if (nameOf(node) === "While Loop") {
                const start = getConditionalValue(node, "startValue");
                const stop = getConditionalValue(node, "stopValue");
                add(`while (${start} ${extras(node).value} ${stop}) {`);
                if (addBlock(node, "body") === 0)
                    add("/* Lacking code to be executed while the condition holds */");
                add("}");
                if (edgesFrom(findPort(node, "else", "source")).length > 0) {
                    add("// after the loop");
                    addBlock(node, "else");
                }
            } else {
                add(String(extras(node).value ?? ""));
            }
        } else {
            warn(`Unsupported connection to "${port.name}"`, node, port);
            add(`/* unsupported connection to ${nameOf(node)}: ${port.name} */`);
        }
    }

    function processLink(link: any) {
        if (depth > 50) {
            warn("Diagram has a cycle; code generation stopped following it");
            return;
        }
        const fromPort = getPort(link.source, link.sourceHandle);
        const toPort = getPort(link.target, link.targetHandle);
        if (!fromPort || !toPort) return;
        const params: any[] = [];
        const target = resolveTarget(toPort, params);
        if (!target) return;
        depth++;
        callWithParameters(target, params, fromPort);
        depth--;
    }
    // #endregion

    function indentCode(original: string) {
        const out: string[] = [];
        let level = 0;
        const tab = "    ";
        original.split("\n").forEach((line) => {
            const trimmed = line.trim();
            if (trimmed.startsWith("}")) level--;
            out.push(tab.repeat(Math.max(level, 0)) + trimmed);
            if (trimmed.endsWith("{")) level++;
        });
        return out.join("\n").trim() + "\n";
    }

    // #region Generator lifecycle
    addHeaderComments();
    warnAboutNumberOfControllers();
    warnAboutPortUsage();
    warnAboutNodesWithoutEdges();
    warnAboutMultipleUsePorts();
    warnAboutLooseEdges();
    addLibraries();
    addConstantDeclarations();
    addVariableDeclarations();
    addFunctionDeclarations();
    addLifecycleMethods();
    // #endregion

    return { code: indentCode(code), problems };
}

/** Kept for compatibility with the previous API: takes { model: JSON string }. */
export default function Code(props: { model: string }): GenerationResult {
    const model = props.model;
    if (!model || model === "{}") return { code: "", problems: [] };
    return generateCode(JSON.parse(model));
}
