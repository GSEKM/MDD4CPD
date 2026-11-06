// Deterministic import of an Arduino sketch (.ino) into a diagram — the
// inverse of src/generator. No language model is involved: a small tokenizer
// and recursive-descent parser map a fixed subset of Arduino C++ to blocks.
//
// Supported:
//   - #include <X.h>          -> blocks of the palette whose library is X.h
//   - #define NAME value      -> Constant(s)
//   - const T NAME = v;       -> Constant(s);  T NAME[= v];  -> Variable(s)
//   - Class obj; Class obj(args);   -> component block (named obj, constructor link)
//   - void name() { ... }     -> Function
//   - inside setup()/loop()/functions/branches:
//       f(args); obj.f(args); Serial.f(args); Class::f(args); name();
//       var = value;   if (x op y) {...} else {...}   while (x op y) {...}
//   - arguments: pin numbers -> Port, HIGH/OUTPUT/true... -> built-in constant,
//     consecutive number literals of one type -> one Parameter(s) ("16, 2"),
//     known names -> Variable/Constant, literals -> Parameter(s); any other
//     expression without commas is kept verbatim in a Parameter(s) block.
// Anything else (for, switch, locals, ++, functions with parameters ...) is
// skipped and reported with its line number. Ordering rules: blocks are
// created in source order of first appearance, links in statement order, and
// among overloads the first one in palette order whose arity fits is used.

import type { Diagram, DEdge, DNode } from "../generator/graph";
import { arity, callName, parseSignature, type Param, type Signature } from "../generator/signature";
import { stripComments } from "../libraries/headerParser";
import { createHandles, withUsage, type HandleInfo } from "../components/nodes/handles";
import { tidyLayout } from "../components/layout";
import { incompatibility } from "../generator/types";

export type ImportNote = { line: number; severity: "info" | "warning"; message: string };
export type SketchImport = {
    diagram: Diagram;
    notes: ImportNote[];
    includes: string[];
    missingIncludes: string[]; // #includes that no palette block provides
};

// #region Tokens
type Tok = { t: "id" | "num" | "str" | "chr" | "op"; v: string; line: number };

const OPS = [
    "<<=", ">>=", "::", "==", "!=", "<=", ">=", "&&", "||", "++", "--", "+=", "-=", "*=", "/=",
    "%=", "&=", "|=", "^=", "->", "<<", ">>",
];

export function tokenize(src: string): Tok[] {
    const toks: Tok[] = [];
    let line = 1;
    let i = 0;
    while (i < src.length) {
        const c = src[i];
        if (c === "\n") {
            line++;
            i++;
        } else if (/\s/.test(c)) i++;
        else if (/[A-Za-z_]/.test(c)) {
            const m = src.slice(i).match(/^[A-Za-z_]\w*/)![0];
            toks.push({ t: "id", v: m, line });
            i += m.length;
        } else if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1]))) {
            const m = src.slice(i).match(/^(0[xX][0-9a-fA-F]+|0[bB][01]+|\d*\.?\d+(?:[eE][+-]?\d+)?)[uUlLfF]*/)![0];
            toks.push({ t: "num", v: m, line });
            i += m.length;
        } else if (c === '"' || c === "'") {
            let j = i + 1;
            while (j < src.length && src[j] !== c) j += src[j] === "\\" ? 2 : 1;
            toks.push({ t: c === '"' ? "str" : "chr", v: src.slice(i, j + 1), line });
            i = j + 1;
        } else {
            const op = OPS.find((o) => src.startsWith(o, i)) ?? c;
            toks.push({ t: "op", v: op, line });
            i += op.length;
        }
    }
    return toks;
}

/** Renders tokens back to C with conventional spacing. */
export function render(toks: Tok[]): string {
    let out = "";
    toks.forEach((tok, k) => {
        const prev = toks[k - 1];
        const prev2 = toks[k - 2];
        const v = tok.v;
        const unary =
            prev && (prev.v === "-" || prev.v === "+" || prev.v === "!" || prev.v === "~") &&
            (!prev2 || (prev2.t === "op" && prev2.v !== ")" && prev2.v !== "]"));
        const tight =
            !prev ||
            [")", "]", ",", ";", ".", "::", "->", "++", "--"].includes(v) ||
            ["(", "[", ".", "::", "->"].includes(prev.v) ||
            ((v === "(" || v === "[") && prev.t === "id") ||
            unary;
        out += (tight ? "" : " ") + v;
    });
    return out;
}

function matching(toks: Tok[], open: number): number {
    const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
    const close = pairs[toks[open].v];
    let depth = 0;
    for (let i = open; i < toks.length; i++) {
        if (toks[i].v === toks[open].v) depth++;
        else if (toks[i].v === close && --depth === 0) return i;
    }
    return toks.length - 1;
}

/** Splits at top-level occurrences of `sep` (outside (), [] and {}). */
function splitTop(toks: Tok[], sep: string): Tok[][] {
    const parts: Tok[][] = [[]];
    let depth = 0;
    for (const t of toks) {
        if (["(", "[", "{"].includes(t.v)) depth++;
        if ([")", "]", "}"].includes(t.v)) depth--;
        if (depth === 0 && t.v === sep) parts.push([]);
        else parts[parts.length - 1].push(t);
    }
    return parts.length === 1 && parts[0].length === 0 ? [] : parts;
}

function indexTop(toks: Tok[], pred: (t: Tok) => boolean): number {
    let depth = 0;
    for (let i = 0; i < toks.length; i++) {
        const t = toks[i];
        if (["(", "[", "{"].includes(t.v)) depth++;
        if ([")", "]", "}"].includes(t.v)) depth--;
        if (depth === 0 && pred(t)) return i;
    }
    return -1;
}
// #endregion

type Use = { node: DNode; inId?: string; outId?: string };
type Source = { node: DNode; handleId: string };

class SketchBuilder {
    nodes: DNode[] = [];
    edges: DEdge[] = [];
    notes: ImportNote[] = [];
    private ids = 0;
    private values = new Map<string, DNode>(); // value key -> block
    private usages = new Map<string, number>(); // block id -> uses so far
    private builtIns = new Map<string, DNode>(); // palette name -> block
    variables = new Map<string, DNode>();
    constants = new Map<string, DNode>();
    objects = new Map<string, DNode>(); // instance name -> component block
    functions = new Map<string, DNode>();
    controller!: DNode;

    constructor(private palette: any[]) {}

    note(line: number, message: string, severity: "info" | "warning" = "warning") {
        this.notes.push({ line, severity, message });
    }

    def(name: string) {
        return this.palette.find((n) => n.name === name);
    }

    addNode(def: any, extras: Record<string, any> = {}): DNode {
        const data = JSON.parse(JSON.stringify(def));
        if (data.extras.type !== "controller") {
            data.extras.returnType = data.extras.returnType || "byte";
            if (data.extras.hasValue && data.extras.value === undefined) data.extras.value = "";
        }
        Object.assign(data.extras, extras);
        data.handles = createHandles(data);
        const node: DNode = { id: `ino-${++this.ids}`, position: { x: 0, y: 0 }, data, ...({ type: "custom" } as any) };
        this.nodes.push(node);
        return node;
    }

    link(from: Source, to: { node: DNode; handleId: string }) {
        this.edges.push({
            id: `ino-e${this.edges.length + 1}`,
            source: from.node.id,
            sourceHandle: from.handleId,
            target: to.node.id,
            targetHandle: to.handleId,
        });
    }

    handles(node: DNode): HandleInfo[] {
        return node.data.handles;
    }

    /** A fresh in/out pair of a value block (the base pair first, then usages). */
    use(node: DNode): Use {
        const k = this.usages.get(node.id) ?? 0;
        this.usages.set(node.id, k + 1);
        if (k > 0) node.data.handles = withUsage(node.data.name, node.data.handles);
        const hs = this.handles(node);
        const label = k === 0 ? "in" : `in-${k}`;
        const inH = hs.find((h) => h.type === "target" && h.edge === label)!;
        const outH = hs.find((h) => h.type === "source" && h.index === inH.index)!;
        return { node, inId: inH.id, outId: outH.id };
    }

    valueBlock(key: string, make: () => DNode): DNode {
        if (!this.values.has(key)) this.values.set(key, make());
        return this.values.get(key)!;
    }

    builtIn(def: any): DNode {
        if (!this.builtIns.has(def.name)) this.builtIns.set(def.name, this.addNode(def));
        return this.builtIns.get(def.name)!;
    }
}

const literalType = (v: string) =>
    /^0[xXbB]/.test(v) ? "int" : /[.eE]/.test(v) && !/[xX]/.test(v) ? "float" : /[uU][lL]$/.test(v) ? "unsigned long" : /[lL]$/.test(v) ? "long" : "int";

export function importSketch(source: string, palette: any[]): SketchImport {
    const b = new SketchBuilder(palette);
    const raw = source.replace(/\r\n?/g, "\n");

    // #region Preprocessor and header
    const header = raw.match(/Code generated for ([^\n*]+)/);
    const controllerDef =
        (header && palette.find((n) => n.extras?.type === "controller" && n.name === header[1].trim())) ||
        palette.find((n) => n.name === "Arduino Uno");
    b.controller = b.addNode(controllerDef);
    if (!header) b.note(1, `No board in the sketch; using ${controllerDef.name}`, "info");

    const cleaned = stripComments(raw);
    const includes: string[] = [];
    const lines = cleaned.split("\n").map((text, k) => {
        const inc = text.match(/^\s*#\s*include\s*[<"]([^>"]+)[>"]/);
        if (inc) {
            if (!includes.includes(inc[1])) includes.push(inc[1]);
            return "";
        }
        const def = text.match(/^\s*#\s*define\s+([A-Za-z_]\w*)\s+(.+?)\s*$/);
        if (def) {
            const value = def[2];
            const type = /^-?[\d.]/.test(value) ? literalType(value.replace(/^-/, "")) : /^"/.test(value) ? "String" : "int";
            b.constants.set(def[1], b.addNode(b.def("Constant(s)"), { returnType: type, name: def[1], value }));
            return "";
        }
        if (/^\s*#/.test(text)) {
            b.note(k + 1, `Preprocessor line ignored: ${text.trim()}`, "info");
            return "";
        }
        return text;
    });
    const components = palette.filter((n) => n.extras?.type === "component");
    const classOf = (name: string) => components.find((c) => (c.extras.className || c.name) === name);
    const core = new Set(["Arduino.h"]);
    const missingIncludes = includes.filter(
        (h) => !core.has(h) && !palette.some((n) => n.extras?.library === h),
    );
    // #endregion

    const toks = tokenize(lines.join("\n"));

    // #region Top level: declarations and function definitions
    type Fn = { name: string; ret: string; params: Tok[]; body: Tok[]; line: number };
    const fns: Fn[] = [];
    let i = 0;
    while (i < toks.length) {
        const start = i;
        let j = i;
        let isDef = false;
        while (j < toks.length) {
            const v = toks[j].v;
            if (v === "(" || v === "[") j = matching(toks, j);
            else if (v === "{") {
                if (toks[j - 1]?.v === "=" || toks[j - 1]?.v === ",") j = matching(toks, j);
                else {
                    isDef = true;
                    break;
                }
            } else if (v === ";") break;
            j++;
        }
        const head = toks.slice(start, j);
        if (isDef) {
            const end = matching(toks, j);
            const body = toks.slice(j + 1, end);
            const open = head.findIndex((t) => t.v === "(");
            if (open > 0 && head[head.length - 1].v === ")" && head[open - 1].t === "id") {
                fns.push({
                    name: head[open - 1].v,
                    ret: render(head.slice(0, open - 1)),
                    params: head.slice(open + 1, head.length - 1),
                    body,
                    line: head[0].line,
                });
            } else b.note(head[0]?.line ?? 0, `Unsupported definition skipped: ${render(head)} { ... }`);
            i = end + 1;
            if (toks[i]?.v === ";") i++;
            continue;
        }
        if (head.length > 0) declaration(head);
        i = j + 1;
    }

    function declaration(head: Tok[]) {
        const line = head[0].line;
        let d = head.filter((t) => !["static", "volatile"].includes(t.v));
        const isConst = d[0]?.v === "const";
        if (isConst) d = d.slice(1);
        // object declaration: Class name; / Class name(args);
        const cls = d[0] && classOf(d[0].v);
        if (cls) {
            for (const decl of splitTop(d.slice(1), ",")) {
                const name = decl[0]?.v;
                if (!name || decl[0].t !== "id") continue;
                const node = b.addNode(cls, { instanceName: name });
                b.objects.set(name, node);
                if (decl[1]?.v === "(") {
                    const args = splitTop(decl.slice(2, matching(decl, 1)), ",");
                    const ctor = pickOverload(node, cls.extras.className || cls.name, args.length, (s) => s.returnType === "", args);
                    if (!ctor) b.note(line, `${cls.name} has no constructor with ${args.length} arguments`);
                    else chainCall({ node: b.controller, handleId: setupHandle() }, ctor.handleId, node, ctor.sig, args, line);
                }
            }
            return;
        }
        // function prototype
        const paren = indexTop(d, (t) => t.v === "(");
        const eq = indexTop(d, (t) => t.v === "=");
        if (paren > 0 && (eq === -1 || paren < eq)) {
            if (d[0] && /^[A-Z]/.test(d[0].v) && d[1]?.t === "id" && d[2]?.v === "(")
                b.note(line, `Unknown class ${d[0].v}: import its library first`);
            return;
        }
        // variables / constants
        const decls = splitTop(d, ",");
        if (decls.length === 0) return;
        const first = decls[0];
        const stop = first.findIndex((t) => t.v === "=" || t.v === "[");
        const nameIdx = (stop === -1 ? first.length : stop) - 1;
        if (nameIdx < 1 || first[nameIdx].t !== "id") {
            b.note(line, `Unsupported declaration skipped: ${render(head)};`);
            return;
        }
        const type = render(first.slice(0, nameIdx));
        decls.forEach((decl, k) => {
            const toks2 = k === 0 ? first.slice(nameIdx) : decl;
            const name = toks2[0]?.v;
            let rest = toks2.slice(1);
            if (rest[0]?.v === "[") rest = rest.slice(matching(rest, 0) + 1);
            let value = "";
            if (rest[0]?.v === "=") {
                const init = rest.slice(1);
                if (init[0]?.v === "{") {
                    value = splitTop(init.slice(1, matching(init, 0)), ",").map(render).join(",");
                } else {
                    value = render(init);
                }
            }
            if (isConst) {
                if (value === "") b.note(line, `Constant ${name} has no value`);
                b.constants.set(name, b.addNode(b.def("Constant(s)"), { returnType: type, name, value }));
                if (name !== name.toUpperCase())
                    b.note(line, `Constant ${name} will be generated as ${name.toUpperCase()}`, "info");
            } else b.variables.set(name, b.addNode(b.def("Variable(s)"), { returnType: type, name, value }));
        });
    }
    // #endregion

    // #region Functions
    function setupHandle() {
        return b.handles(b.controller).find((h) => h.type === "source" && h.edge === "setup()")!.id;
    }
    function lifecycle(name: string) {
        return b.handles(b.controller).find((h) => h.type === "source" && h.edge === `${name}()`)?.id;
    }

    const bodies: { src: Source; body: Tok[] }[] = [];
    for (const f of fns) {
        const lc = lifecycle(f.name);
        if (lc && f.params.length === 0) {
            bodies.push({ src: { node: b.controller, handleId: lc }, body: f.body });
        } else if (f.ret === "void" && (f.params.length === 0 || (f.params.length === 1 && f.params[0].v === "void"))) {
            const node = b.addNode(b.def("Function"), { value: f.name, returnType: "void" });
            b.functions.set(f.name, node);
            const body = b.handles(node).find((h) => h.type === "source" && h.edge === "body")!;
            bodies.push({ src: { node, handleId: body.id }, body: f.body });
        } else {
            b.note(f.line, `Function ${f.name} has parameters or a return value, which blocks cannot express; skipped`);
        }
    }
    // lifecycle bodies first so setup()/loop() statements keep their order
    bodies
        .sort((x, y) => Number(y.src.node === b.controller) - Number(x.src.node === b.controller))
        .forEach(({ src, body }) => block(body, src));
    // #endregion

    // #region Statements
    function block(ts: Tok[], src: Source) {
        let k = 0;
        while (k < ts.length) k = statement(ts, k, src);
    }

    /** End (exclusive) of the statement starting at k, for skipping. */
    function statementEnd(ts: Tok[], k: number): number {
        const v = ts[k]?.v;
        if (v === "{") return matching(ts, k) + 1;
        if (v === "for" || v === "switch" || v === "while" || v === "if") {
            let e = statementEnd(ts, matching(ts, k + 1) + 1);
            if (v === "if" && ts[e]?.v === "else") e = statementEnd(ts, e + 1);
            return e;
        }
        if (v === "do") {
            const e = statementEnd(ts, k + 1); // body, then while (...) ;
            return matching(ts, e + 1) + 2;
        }
        let e = k;
        while (e < ts.length && ts[e].v !== ";") e = ts[e].v === "(" || ts[e].v === "{" || ts[e].v === "[" ? matching(ts, e) + 1 : e + 1;
        return e + 1;
    }

    function statement(ts: Tok[], k: number, src: Source): number {
        const t = ts[k];
        if (t.v === ";") return k + 1;
        if (t.v === "{") {
            const e = matching(ts, k);
            block(ts.slice(k + 1, e), src);
            return e + 1;
        }
        if (t.v === "if" || t.v === "while") {
            const close = matching(ts, k + 1);
            const cond = ts.slice(k + 2, close);
            const thenEnd = statementEnd(ts, close + 1);
            const node = b.addNode(b.def(t.v === "if" ? "Condition" : "While Loop"), { value: "==" });
            const [xLabel, yLabel] = t.v === "if" ? ["void set(T xValue)", "void set(T yValue)"] : ["startValue", "stopValue"];
            if (!condition(cond, node, xLabel, yLabel, src, t.line)) {
                b.nodes.splice(b.nodes.indexOf(node), 1);
                return statementEnd(ts, k);
            }
            const out = (label: string) => ({ node, handleId: b.handles(node).find((h) => h.type === "source" && h.edge === label)!.id });
            block(ts.slice(close + 1, thenEnd), out("body"));
            if (ts[thenEnd]?.v === "else") {
                if (t.v === "while") return thenEnd; // cannot happen in valid C
                const elseEnd = statementEnd(ts, thenEnd + 1);
                block(ts.slice(thenEnd + 1, elseEnd), out("else"));
                return elseEnd;
            }
            return thenEnd;
        }
        if (["for", "do", "switch", "return", "break", "continue", "goto", "case", "default"].includes(t.v)) {
            const e = statementEnd(ts, k);
            b.note(t.line, `\`${t.v}\` is not supported by the block language; skipped lines ${t.line}–${ts[e - 1].line}`);
            return e;
        }
        const e = statementEnd(ts, k);
        expression(ts.slice(k, e - 1), src, t.line);
        return e;
    }

    /** Wires `x op y` into a Condition/While block. */
    function condition(cond: Tok[], node: DNode, xLabel: string, yLabel: string, src: Source, line: number): boolean {
        const target = (label: string) => b.handles(node).find((h) => h.type === "target" && h.edge === label)!.id;
        const logical = indexTop(cond, (t) => t.v === "&&" || t.v === "||") !== -1;
        const at = logical ? -1 : indexTop(cond, (t) => ["==", "!=", "<=", ">=", "<", ">"].includes(t.v));
        let x = cond;
        let y: Tok[] = [{ t: "num", v: "0", line }];
        let op = "!=";
        if (at > 0) {
            x = cond.slice(0, at);
            op = cond[at].v;
            y = cond.slice(at + 1);
        } else {
            if (logical) x = [{ t: "op", v: "(", line }, ...cond, { t: "op", v: ")", line }];
            b.note(line, `Condition \`${render(cond)}\` is written as \`${render(x)} != 0\``, "info");
        }
        node.data.extras.value = op;
        // x: operand and trigger; y: operand only
        const xs = operand(x, line);
        const ys = operand(y, line);
        if (!xs || !ys) return false;
        if (xs.method) b.link(xs.method, { node, handleId: target(xLabel) });
        if (ys.method) b.link(ys.method, { node, handleId: target(yLabel) });
        else b.link({ node: ys.use!.node, handleId: ys.use!.outId! }, { node, handleId: target(yLabel) });
        if (xs.method) b.link(src, { node, handleId: target(xLabel) });
        else {
            b.link(src, { node: xs.use!.node, handleId: xs.use!.inId! });
            b.link({ node: xs.use!.node, handleId: xs.use!.outId! }, { node, handleId: target(xLabel) });
        }
        return true;
    }

    /** A condition operand: a value block, or a no-argument method of an object. */
    function operand(ts: Tok[], line: number): { use?: Use; method?: Source } | null {
        const call = parseCall(ts);
        if (call && call.args.length === 0) {
            const t = resolveCall(call, line, true);
            if (t) {
                const out = b.handles(t.node).find((h) => h.type === "source" && h.index === b.handles(t.node).find((x) => x.id === t.handleId)!.index)!;
                return { method: { node: t.node, handleId: out.id } };
            }
        }
        const use = value(ts, null, line);
        return use ? { use } : null;
    }

    type Call = { object?: string; staticClass?: string; name: string; args: Tok[][] };

    function parseCall(ts: Tok[]): Call | null {
        let k = 0;
        let object: string | undefined;
        let staticClass: string | undefined;
        if (ts[0]?.t === "id" && ts[1]?.v === "." && ts[2]?.t === "id") {
            object = ts[0].v;
            k = 2;
        } else if (ts[0]?.t === "id" && ts[1]?.v === "::" && ts[2]?.t === "id") {
            staticClass = ts[0].v;
            k = 2;
        }
        if (ts[k]?.t !== "id" || ts[k + 1]?.v !== "(") return null;
        const close = matching(ts, k + 1);
        if (close !== ts.length - 1) return null;
        return { object, staticClass, name: ts[k].v, args: splitTop(ts.slice(k + 2, close), ",") };
    }

    /** Best-effort type of an argument, used only to choose among overloads. */
    function argType(ts: Tok[]): string {
        if (ts.length !== 1) return "";
        const [t] = ts;
        if (t.t === "num") return literalType(t.v);
        if (t.t === "str") return "String";
        if (t.t === "chr") return "char";
        const known = b.variables.get(t.v) ?? b.constants.get(t.v);
        if (known) return known.data.extras.returnType;
        return palette.find((n) => n.extras?.type === "built-in-constant" && n.name === t.v)?.extras.returnType ?? "";
    }

    function pickOverload(
        node: DNode,
        name: string,
        argc: number,
        filter: (s: Signature) => boolean = () => true,
        args: Tok[][] = [],
    ) {
        const candidates = b
            .handles(node)
            .filter((h) => h.type === "target")
            .map((h) => ({ handleId: h.id, sig: parseSignature(h.edge) }))
            .filter((c): c is { handleId: string; sig: Signature } => !!c.sig && c.sig.name === name && filter(c.sig));
        const fits = candidates.filter((c) => {
            const [min, max] = arity(c.sig);
            return argc >= min && argc <= max;
        });
        const types = args.map(argType);
        const compatible = fits.filter((c) => types.every((t, k) => !t || !incompatibility(c.sig.params[k]?.type ?? "", t)));
        return (
            compatible.find((c) => c.sig.params.length === argc) ??
            compatible[0] ??
            fits.find((c) => c.sig.params.length === argc) ??
            fits[0] ??
            null
        );
    }

    function resolveCall(call: Call, line: number, quiet = false): { node: DNode; handleId: string; sig: Signature } | null {
        const argc = call.args.length;
        const fail = (msg: string) => {
            if (!quiet) b.note(line, msg);
            return null;
        };
        if (call.object) {
            let node = b.objects.get(call.object);
            if (!node) {
                const def = palette.find((n) => n.extras?.type === "built-in" && n.extras.object === call.object);
                if (!def) return fail(`Unknown object ${call.object}`);
                node = b.builtIn(def);
            }
            const pick = pickOverload(node, call.name, argc, undefined, call.args);
            return pick ? { node, ...pick } : fail(`${call.object} has no function ${call.name} taking ${argc} arguments`);
        }
        if (call.staticClass) {
            const node = [...b.objects.values()].find((n) => (n.data.extras.className || n.data.name) === call.staticClass);
            if (!node) return fail(`Static call ${call.staticClass}::${call.name} needs a ${call.staticClass} object in the sketch`);
            const pick = pickOverload(node, call.name, argc, (s) => s.isStatic);
            return pick ? { node, ...pick } : fail(`${call.staticClass} has no static function ${call.name}`);
        }
        const fn = b.functions.get(call.name);
        if (fn) {
            if (argc > 0) return fail(`Function ${call.name} takes no arguments in the block language`);
            return { node: fn, handleId: b.handles(fn).find((h) => h.type === "target" && h.edge === "in")!.id, sig: parseSignature("void in()")! };
        }
        for (const def of palette.filter((n) => n.extras?.type === "built-in" && !n.extras.object)) {
            const has = (def.methods || []).some((m: string) => callName(m) === call.name);
            if (!has) continue;
            const node = b.builtIn(def);
            const pick = pickOverload(node, call.name, argc, undefined, call.args);
            if (pick) return { node, ...pick };
        }
        return fail(`Unknown function ${call.name}(${argc} arguments)`);
    }

    function expression(ts: Tok[], src: Source, line: number) {
        if (ts.length === 0) return;
        // assignment to a global variable
        if (ts[0].t === "id" && ts[1]?.v === "=") {
            const variable = b.variables.get(ts[0].v);
            if (!variable) {
                b.note(line, `Assignment to ${ts[0].v} skipped: only global variables are supported`);
                return;
            }
            const setter = "void setValue(<T> value)";
            const hs = b.handles(variable);
            const index = Math.max(-1, ...hs.map((h) => h.index)) + 1;
            hs.push(
                { id: `source-${index}`, edge: setter, index, type: "source", position: "right", isConnectable: true },
                { id: `target-${index}`, edge: setter, index, type: "target", position: "left", isConnectable: true },
            );
            // the assigned value takes the variable's type (the setter is generic)
            const sig = parseSignature(`void setValue(${variable.data.extras.returnType} value)`)!;
            chainCall(src, `target-${index}`, variable, sig, [ts.slice(2)], line);
            return;
        }
        if (ts.some((t) => ["++", "--", "+=", "-=", "*=", "/=", "%=", "|=", "&=", "^=", "<<=", ">>="].includes(t.v))) {
            b.note(line, `\`${render(ts)};\` skipped: rewrite it as an assignment (x = x + 1)`);
            return;
        }
        const call = parseCall(ts);
        if (!call) {
            b.note(line, `Unsupported statement skipped: ${render(ts)};`);
            return;
        }
        const target = resolveCall(call, line);
        if (target) chainCall(src, target.handleId, target.node, target.sig, call.args, line);
    }

    /** src -> arg1 -> arg2 ... -> target handle. */
    function chainCall(src: Source, handleId: string, node: DNode, sig: Signature, args: Tok[][], line: number) {
        const uses: Use[] = [];
        // Consecutive number literals of the same type share one Parameter(s)
        // block ("16, 2"), as Parameter(s) holds a list; pins stay Port blocks.
        const literal = (k: number) => {
            const ts = args[k];
            if (ts.length !== 1 || ts[0].t !== "num") return null;
            if (/pin/i.test(sig.params[k]?.name ?? "") && /^\d+$/.test(ts[0].v) && Number(ts[0].v) < 100) return null;
            return literalType(ts[0].v);
        };
        for (let k = 0; k < args.length; k++) {
            const type = literal(k);
            let end = k + 1;
            while (type && end < args.length && literal(end) === type) end++;
            if (type && end - k > 1) {
                const values = args.slice(k, end).map((a) => a[0].v).join(", ");
                uses.push(b.use(b.valueBlock(`param:${type}:${values}`, () => b.addNode(b.def("Parameter(s)"), { returnType: type, value: values }))));
                k = end - 1;
                continue;
            }
            const use = value(args[k], sig.params[k] ?? null, line);
            if (!use) return;
            uses.push(use);
        }
        let from = src;
        for (const u of uses) {
            b.link(from, { node: u.node, handleId: u.inId! });
            from = { node: u.node, handleId: u.outId! };
        }
        b.link(from, { node, handleId });
    }

    /** The value block for an argument or operand, with a fresh usage. */
    function value(ts: Tok[], param: Param | null, line: number): Use | null {
        const text = render(ts);
        const generic = !param?.type || /^(<T>|T|\?|any\??|auto)$/.test(param.type.trim());
        const expected = generic ? "int" : param!.type.replace(/\bconst\b|&/g, "").trim();
        if (ts.length === 1) {
            const [t] = ts;
            if (t.t === "num" && /pin/i.test(param?.name ?? "") && /^\d+$/.test(t.v) && Number(t.v) < 100)
                return b.use(b.valueBlock(`port:${t.v}`, () => b.addNode(b.def("Port"), { value: t.v, portType: "Digital" })));
            if (t.t === "num") {
                const type = literalType(t.v);
                return b.use(b.valueBlock(`param:${type}:${t.v}`, () => b.addNode(b.def("Parameter(s)"), { returnType: type, value: t.v })));
            }
            if (t.t === "str" || t.t === "chr") {
                const type = t.t === "str" ? "String" : "char";
                return b.use(b.valueBlock(`param:${type}:${t.v}`, () => b.addNode(b.def("Parameter(s)"), { returnType: type, value: t.v })));
            }
            if (t.t === "id") {
                if (b.variables.has(t.v)) return b.use(b.variables.get(t.v)!);
                if (b.constants.has(t.v)) return b.use(b.constants.get(t.v)!);
                const bic = palette.find((n) => n.extras?.type === "built-in-constant" && n.name === t.v);
                if (bic) return b.use(b.valueBlock(`bic:${t.v}`, () => b.addNode(bic)));
            }
        }
        b.note(line, `\`${text}\` kept as text in a Parameter(s) block`, "info");
        return b.use(b.valueBlock(`param:${expected}:${text}`, () => b.addNode(b.def("Parameter(s)"), { returnType: expected, value: text })));
    }
    // #endregion

    // #region Layout (estimated sizes; the editor re-runs it with real ones)
    const estimate = (n: DNode) => {
        const d = n.data;
        const rows = Math.max(0, ...d.handles.map((h: HandleInfo) => h.index + 1));
        const editors = ["hasReturnType", "hasPortType", "hasUsername", "hasValue"].filter((k) => d.extras[k]).length;
        const longest = Math.max(8, ...d.handles.map((h: HandleInfo) => h.edge.length));
        return {
            id: n.id,
            position: n.position!,
            data: d,
            width: Math.min(320, 60 + longest * 6.5),
            height: 44 + editors * 29 + Math.min(rows, 10) * 26 + (d.extras.hasUsages ? 32 : 0),
        };
    };
    const positions = tidyLayout(b.nodes.map(estimate), b.edges, []);
    b.nodes.forEach((n) => (n.position = positions.get(n.id) ?? { x: 0, y: 0 }));
    // #endregion

    b.notes.sort((x, y) => x.line - y.line);
    return { diagram: { nodes: b.nodes, edges: b.edges }, notes: b.notes, includes, missingIncludes };
}
