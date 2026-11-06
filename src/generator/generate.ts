// Deterministic Arduino code generator for MDD4CPD diagrams.
//
// The output is a pure function of the diagram: no randomness, clocks,
// network or language models are involved, and the input is never mutated.
// Ordering rules (so that the same diagram always yields the same sketch):
//   - blocks keep their order in the model (creation order) — this decides
//     object instance names (servo0, servo1, ...) and declaration order;
//   - links keep their order in the model (creation order) — this decides
//     the order of statements inside setup(), loop(), functions and branches.
//
// Semantics (from the original tool, rzfzr/MDD4CPD-Legacy):
//   - each out-handle of the micro-controller (setup(), loop()) is a lifecycle
//     method; each link leaving it is one statement;
//   - a link may pass through a chain of value blocks (Port, Parameter(s),
//     Variable(s), Constant(s), built-in constants) before reaching a function
//     handle; the values met on the way become the call's arguments;
//   - value blocks pair their handles by index (in-k feeds out-k).

import { Graph, extras, isValue, nameOf, typeOf, type DEdge, type DNode, type Diagram, type Port } from "./graph";
import { Problems, type Problem } from "./problems";
import { arity, callName, parseSignature, splitValues, type Signature } from "./signature";
import { incompatibility } from "./types";
import { CodeWriter, type Entry } from "./writer";

export type { Problem } from "./problems";
/**
 * One generated statement and the diagram elements it comes from. `order` is
 * its 1-based position among the links leaving the same handle (the order of
 * the statement in its block); `lines` are 0-based line numbers in `code`.
 */
export type Statement = {
    id: number;
    sourceNodeId: string;
    sourceHandleId: string;
    order: number;
    edgeIds: string[]; // the first link, then the argument chain
    nodeIds: string[]; // blocks on the chain, call target last
    lines: number[];
};

export type GenerationResult = {
    code: string;
    problems: Problem[];
    statements: Statement[];
};

const ordinals = [
    "first", "second", "third", "fourth", "fifth", "sixth",
    "seventh", "eighth", "ninth", "tenth", "eleventh",
];
const MAX_DEPTH = 50;

/** A value flowing into a call: its C expression and type. */
type Arg = { expr: string; type: string; node: DNode };

export function generateCode(model: Diagram): GenerationResult {
    return new Generator(new Graph(model)).run();
}

class Generator {
    private out = new CodeWriter();
    private problems = new Problems();
    private depth = 0;

    private controllers: DNode[];
    private controller: DNode | undefined;
    private components: DNode[] = [];
    private instances = new Map<string, string>(); // node id -> instance name
    private constructorArgs = new Map<string, string>(); // node id -> "(a, b)"
    private declaredFunctions = new Set<string>();
    private statements: Statement[] = [];

    constructor(private g: Graph) {
        this.controllers = g.nodes.filter((n) => typeOf(n) === "controller");
        this.controller = this.controllers[0];
        // Instance names: a valid, unique extras.instanceName is kept (e.g. from
        // an imported sketch); otherwise <class><k> in block order.
        const components = g.nodes.filter((n) => typeOf(n) === "component");
        const taken = new Set<string>();
        const custom = new Map<string, string>();
        components.forEach((n) => {
            const name = String(extras(n).instanceName ?? "");
            if (/^[A-Za-z_]\w*$/.test(name) && !taken.has(name)) {
                taken.add(name);
                custom.set(n.id, name);
            }
        });
        const counts = new Map<string, number>();
        components.forEach((n) => {
            let name = custom.get(n.id);
            if (!name) {
                const base = this.className(n).toLowerCase().replace(/[^a-z0-9_]/g, "") || "object";
                do {
                    const k = counts.get(base) ?? 0;
                    counts.set(base, k + 1);
                    name = base + k;
                } while (taken.has(name));
                taken.add(name);
            }
            this.instances.set(n.id, name);
            this.components.push(n);
        });
    }

    run(): GenerationResult {
        this.validate();
        // Statements are rendered first: constructor links found there
        // decide how objects are declared.
        const functions = this.functionsSection();
        const lifecycle = this.lifecycleSection();

        this.header();
        this.librariesAndObjects();
        this.constants();
        this.variables();
        if (functions.length > 0) {
            this.out.blank();
            this.out.comment("Functions");
            this.out.append(functions);
        }
        this.out.blank();
        this.out.comment("Micro-controller's Lifecycle");
        this.out.append(lifecycle);

        const entries = this.out.entries();
        entries.forEach((e, i) => {
            if (e.tag !== null) this.statements[e.tag].lines.push(i);
        });
        return {
            code: this.out.toString(),
            problems: this.problems.list,
            statements: this.statements,
        };
    }

    // #region Model checks
    private validate() {
        const p = this.problems;
        if (this.controllers.length === 0) p.add("no-controller", "No micro-controller");
        if (this.controllers.length > 1)
            this.controllers.forEach((c) => p.add("multiple-controllers", "More than one micro-controller", c));

        const limits = { Digital: extras(this.controller).digitalPorts, Analog: extras(this.controller).analogPorts };
        this.g.nodes
            .filter((n) => extras(n).portType in limits)
            .forEach((n) => {
                const limit = limits[extras(n).portType as "Digital" | "Analog"];
                if (limit !== undefined && Number(extras(n).value) >= limit)
                    p.add("port-out-of-range", `This ${nameOf(n)} does not exist on this micro-controller`, n);
            });

        this.g.nodes.forEach((n) => {
            if (this.g.edgesOf(n).length === 0) p.add("unlinked-block", "This component has no links", n);
        });

        this.g.nodes.filter(isValue).forEach((n) => {
            this.g
                .handles(n)
                .filter((h) => h.type === "source" && h.edge.startsWith("out"))
                .forEach((h) => {
                    const count = this.g.from({ node: n, handle: h, name: h.edge }).length;
                    const what = nameOf(n).toLowerCase();
                    if (count > 1)
                        p.add("multiple-links", `This ${what} has more than one link in the same ${h.edge} port.`, n, h.id);
                    else if (count === 0) p.add("unused-value", `This ${what} is not being used.`, n, h.id);
                });
        });

        this.g.edges.forEach((e) => {
            if (!this.g.sourceOf(e) || !this.g.targetOf(e)) p.add("loose-link", "Loose link", this.g.node(e.source));
        });
    }
    // #endregion

    // #region Declarations
    private header() {
        const used = (type: string) => [
            ...new Set(this.g.nodes.filter((n) => extras(n).portType === type).map((n) => extras(n).value)),
        ];
        const digital = used("Digital");
        const analog = used("Analog");
        const c = extras(this.controller);
        const list = (xs: any[]) => (xs.length ? ` (${xs.join(", ")})` : "");
        this.out.line(`/* Code generated for ${nameOf(this.controller) || "(no micro-controller)"}`);
        this.out.line(`Analog ports ${analog.length}/${c.analogPorts ?? "?"}${list(analog)}`);
        this.out.line(`Digital ports ${digital.length}/${c.digitalPorts ?? "?"}${list(digital)} */`);
    }

    private className(n: DNode) {
        return extras(n).className || nameOf(n);
    }

    private librariesAndObjects() {
        const libraries = new Map<string, string>(); // header -> version note
        this.components.forEach((c) => {
            const lib = extras(c).library;
            if (!lib || libraries.has(lib)) return;
            const pkg = extras(c).packageName;
            const version = extras(c).version;
            libraries.set(lib, pkg && version ? ` // ${pkg} ${version}` : "");
        });
        if (libraries.size > 0) {
            this.out.blank();
            this.out.comment("Libraries");
            libraries.forEach((note, lib) => this.out.line(`#include <${lib}>${note}`));
        }
        if (this.components.length > 0) {
            this.out.blank();
            this.out.comment("Objects");
            this.components.forEach((c) =>
                this.out.line(`${this.className(c)} ${this.instances.get(c.id)}${this.constructorArgs.get(c.id) ?? ""};`),
            );
        }
    }

    private declaration(node: DNode, name: string) {
        const values = this.valuesOf(node);
        const isArray = values.length > 1;
        return {
            type: extras(node).returnType || "byte",
            name: name + (isArray ? `[${values.length}]` : ""),
            value: isArray ? `{${values.join(", ")}}` : values[0],
        };
    }

    private constants() {
        const constants = this.g.nodes.filter((n) => typeOf(n) === "constant");
        if (constants.length === 0) return;
        this.out.blank();
        this.out.comment("Constants");
        constants.forEach((c) => {
            const d = this.declaration(c, this.constantName(c));
            this.out.line(`const ${d.type} ${d.name} = ${d.value};`);
        });
    }

    private variables() {
        const variables = this.g.nodes.filter((n) => typeOf(n) === "variable");
        if (variables.length === 0) return;
        this.out.blank();
        this.out.comment("Variables");
        variables.forEach((v) => {
            const d = this.declaration(v, extras(v).name || "var");
            this.out.line(`${d.type} ${d.name}${d.value !== "" ? " = " + d.value : ""};`);
        });
    }

    /** Global function declarations as lines. */
    private functionsSection(): Entry[] {
        const w = new CodeWriter();
        this.g.nodes
            .filter((n) => typeOf(n) === "logic" && nameOf(n) === "Function")
            .forEach((f) => {
                const name = this.functionName(f);
                if (this.declaredFunctions.has(name)) return;
                this.declaredFunctions.add(name);
                w.block(`${extras(f).returnType || "void"} ${name}()`, () =>
                    this.emitAll(w, this.g.findPort(f, "body", "source")),
                );
            });
        return lines(w);
    }

    /** setup()/loop() as lines. */
    private lifecycleSection(): Entry[] {
        if (!this.controller) return [];
        const w = new CodeWriter();
        this.g
            .handles(this.controller)
            .filter((h) => h.type === "source")
            .forEach((h) => {
                w.block(`void ${h.edge}`, () =>
                    this.emitAll(w, { node: this.controller!, handle: h, name: h.edge }),
                );
                w.blank();
            });
        return lines(w);
    }
    // #endregion

    // #region Values
    private constantName(n: DNode) {
        return String(extras(n).name || "con").toUpperCase();
    }

    private functionName(n: DNode) {
        return String(extras(n).value || "foo").replace(/\s/g, "");
    }

    private valuesOf(n: DNode): string[] {
        if (typeOf(n) === "built-in-constant") return [nameOf(n)];
        return splitValues(String(extras(n).value ?? ""));
    }

    /** Arguments contributed by a value block, with their types. */
    private argsOf(n: DNode): Arg[] {
        const type = extras(n).returnType || "byte";
        switch (typeOf(n)) {
            case "parameter":
            case "port":
                return this.valuesOf(n).map((v) => ({ expr: v, type, node: n }));
            case "constant":
                return [{ expr: this.constantName(n), type, node: n }];
            case "variable":
                return [{ expr: extras(n).name || "var", type, node: n }];
            case "built-in-constant":
                return [{ expr: nameOf(n), type, node: n }];
            default:
                return [];
        }
    }

    /** Value of a condition/loop operand: the block linked into that input. */
    private operand(node: DNode, label: string): string {
        const edge = this.g.to(this.g.findPort(node, label, "target"))[0];
        const port = edge && this.g.sourceOf(edge);
        if (!port) return "/* Lacking Value */";
        const src = port.node;
        if (isValue(src)) return this.argsOf(src).map((a) => a.expr).join(", ");
        if (typeOf(src) === "component") return `${this.instances.get(src.id)}.${callName(port.name)}()`;
        if (typeOf(src) === "built-in")
            return `${extras(src).object ? extras(src).object + "." : ""}${callName(port.name)}()`;
        return "/* Unknown value type */";
    }
    // #endregion

    // #region Statements
    private emitAll(w: CodeWriter, port: Port | null) {
        this.g.from(port).forEach((edge) => this.emitLink(w, edge));
    }

    /** Follows a chain of value blocks, collecting them as arguments. */
    private resolve(toPort: Port, args: Arg[], seen: Set<string>, chain: DEdge[]): Port | null {
        if (!isValue(toPort.node)) return toPort;
        if (toPort.name.startsWith("void setValue")) return toPort; // assignment
        if (seen.has(toPort.node.id)) return null; // cycle
        seen.add(toPort.node.id);
        args.push(...this.argsOf(toPort.node));
        const next = this.g.from(this.g.pairedOut(toPort))[0];
        const nextPort = next && this.g.targetOf(next);
        if (!nextPort) return null;
        chain.push(next);
        return this.resolve(nextPort, args, seen, chain);
    }

    private emitLink(w: CodeWriter, edge: DEdge) {
        if (this.depth > MAX_DEPTH) {
            this.problems.add("cycle", "Diagram has a cycle; code generation stopped following it");
            return;
        }
        const fromPort = this.g.sourceOf(edge);
        const toPort = this.g.targetOf(edge);
        if (!fromPort || !toPort) return;
        const args: Arg[] = [];
        const chain: DEdge[] = [edge];
        const target = this.resolve(toPort, args, new Set(), chain);
        const statement: Statement = {
            id: this.statements.length,
            sourceNodeId: fromPort.node.id,
            sourceHandleId: fromPort.handle.id,
            order: this.g.from(fromPort).indexOf(edge) + 1,
            edgeIds: chain.map((e) => edgeId(this.g, e)),
            nodeIds: [...new Set(chain.map((e) => e.target))],
            lines: [],
        };
        this.statements.push(statement);
        if (!target) return;
        this.depth++;
        w.withTag(statement.id, () => this.emitCall(w, target, args, fromPort));
        this.depth--;
    }

    private checkArgs(port: Port, sig: Signature, args: Arg[]): boolean {
        const [min, max] = arity(sig);
        if (args.length < min || args.length > max) {
            const count = min === max ? `${min}` : `${min} to ${max}`;
            this.problems.add(
                "arity",
                `The function call "${port.name}" is receiving ${args.length} parameters instead of the expected ${count}`,
                port.node,
                port.handle.id,
            );
            return false;
        }
        args.forEach((a, i) => {
            const expected = sig.params[i]?.type ?? "";
            const reason = incompatibility(expected, a.type);
            if (reason)
                this.problems.add(
                    "type",
                    `The function call "${port.name}" expects its ${ordinals[i] ?? `#${i + 1}`} parameter to be of type "${expected}", received "${a.type}" instead (${reason})`,
                    port.node,
                    port.handle.id,
                );
        });
        return true;
    }

    private emitCall(w: CodeWriter, port: Port, args: Arg[], fromPort: Port) {
        const node = port.node;
        const argList = args.map((a) => a.expr).join(", ");

        if (typeOf(node) === "logic") return this.emitLogic(w, node, port, args);

        const sig = parseSignature(port.name);
        if (sig && !this.checkArgs(port, sig, args)) return;

        const instance = this.instances.get(node.id);
        if (instance && sig && sig.returnType === "" && sig.name === this.className(node)) {
            // Constructor: arguments go into the object declaration.
            if (this.constructorArgs.has(node.id))
                this.problems.add("constructor", `${instance} is constructed more than once`, node, port.handle.id);
            this.constructorArgs.set(node.id, args.length ? `(${argList})` : "");
            return;
        }
        if (instance && sig?.isStatic) return w.line(`${this.className(node)}::${sig.name}(${argList});`);
        if (instance) return w.line(`${instance}.${callName(port.name)}(${argList});`);

        const fromInstance = this.instances.get(fromPort.node.id);
        if (fromInstance) return w.line(`${fromInstance}.${callName(fromPort.name)}();`);

        if (port.name.startsWith("void setValue")) return w.line(`${extras(node).name} = ${argList};`);
        if (typeOf(node) === "built-in") {
            // core objects such as Serial: extras.object = "Serial"
            const object = extras(node).object ? `${extras(node).object}.` : "";
            return w.line(`${object}${callName(port.name)}(${argList});`);
        }

        this.problems.add("unsupported", `Unsupported connection to "${port.name}"`, node, port.handle.id);
        w.line(`/* unsupported connection to ${nameOf(node)}: ${port.name} */`);
    }

    private emitLogic(w: CodeWriter, node: DNode, port: Port, args: Arg[]) {
        const name = nameOf(node);
        if (name === "Function") {
            if (port.name === "declare") return; // functions are declared globally
            if (args.length > 0)
                this.problems.add("arity", `The function "${this.functionName(node)}" takes no parameters`, node, port.handle.id);
            return w.line(`${this.functionName(node)}();`);
        }
        const branch = (label: string) => this.g.from(this.g.findPort(node, label, "source"));
        if (name === "Condition") {
            const x = this.operand(node, "void set(T xValue)");
            const y = this.operand(node, "void set(T yValue)");
            w.block(`if (${x} ${extras(node).value} ${y})`, () => {
                const body = branch("body");
                if (body.length === 0) w.comment("Lacking code to be executed if conditional is true");
                body.forEach((e) => this.emitLink(w, e));
                const otherwise = branch("else");
                if (otherwise.length > 0) {
                    w.dedentLine("} else {");
                    otherwise.forEach((e) => this.emitLink(w, e));
                }
            });
            return;
        }
        if (name === "While Loop") {
            const start = this.operand(node, "startValue");
            const stop = this.operand(node, "stopValue");
            w.block(`while (${start} ${extras(node).value} ${stop})`, () => {
                const body = branch("body");
                if (body.length === 0) w.comment("Lacking code to be executed while the condition holds");
                body.forEach((e) => this.emitLink(w, e));
            });
            const after = branch("else");
            if (after.length > 0) {
                w.comment("after the loop");
                after.forEach((e) => this.emitLink(w, e));
            }
            return;
        }
        w.line(String(extras(node).value ?? ""));
    }
    // #endregion
}

function lines(w: CodeWriter): Entry[] {
    return w.entries();
}

/** Edge id, or a stable positional id for models whose edges have none. */
function edgeId(g: Graph, e: DEdge): string {
    return e.id ?? `edge-${g.edges.indexOf(e)}`;
}
