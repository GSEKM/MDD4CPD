// Parsing of the C/C++ function signatures used as handle labels, e.g.
//   "void pinMode(int pin, int mode)"
//   "static uint8_t Foo::bar(const char *s, int n = 3)"
//   "Stepper(int, int, int)"            (constructor: no return type)
// Shared by the generator, the node UI and the library importer.

export type Param = {
    raw: string;
    type: string; // "" when unknown
    name: string; // "" when unnamed (e.g. "int")
    defaultValue?: string;
};

export type Signature = {
    raw: string;
    returnType: string; // "" for constructors
    name: string;
    params: Param[];
    isStatic: boolean;
};

const typeWords = new Set([
    "void", "bool", "boolean", "char", "short", "int", "long", "float", "double",
    "signed", "unsigned", "const", "volatile", "struct", "enum", "class", "byte",
    "word", "String", "size_t",
]);

/** Splits at top-level separators, ignoring those nested in (), <>, [] and {}. */
export function splitTopLevel(text: string, separator: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let current = "";
    for (const ch of text) {
        if ("(<[{".includes(ch)) depth++;
        else if (")>]}".includes(ch)) depth = Math.max(0, depth - 1);
        if (ch === separator && depth === 0) {
            parts.push(current);
            current = "";
        } else current += ch;
    }
    parts.push(current);
    return parts;
}

export function parseParam(raw: string): Param {
    const text = raw.trim();
    const [decl, ...rest] = splitTopLevel(text, "=");
    const defaultValue = rest.length ? rest.join("=").trim() : undefined;
    const d = decl.trim().replace(/\s+/g, " ");
    // name = trailing identifier (optionally followed by [] for arrays)
    const m = d.match(/^(.*?)([A-Za-z_]\w*)\s*(\[[^\]]*\])?$/);
    if (m && m[1].trim() !== "" && !typeWords.has(m[2]) && !/[(<]$/.test(m[1].trim())) {
        const type = (m[1] + (m[3] ? "*" : "")).trim().replace(/\s*([*&])\s*/g, "$1 ").trim();
        return { raw: text, type: type.replace(/ $/, ""), name: m[2], defaultValue };
    }
    return { raw: text, type: d, name: "", defaultValue };
}

/** Returns null for labels that are not calls ("in", "body", "setup()" is a call). */
export function parseSignature(raw: string): Signature | null {
    const text = raw.trim().replace(/\s+/g, " ");
    const open = text.indexOf("(");
    const close = text.lastIndexOf(")");
    if (open === -1 || close < open) return null;
    const head = text.substring(0, open).trim();
    const m = head.match(/^(.*?)([A-Za-z_~]\w*(?:::[A-Za-z_~]\w*)*)$/);
    if (!m) return null;
    let returnType = m[1].trim();
    let isStatic = false;
    if (/^static\b/.test(returnType)) {
        isStatic = true;
        returnType = returnType.replace(/^static\s*/, "");
    }
    const name = m[2].split("::").pop()!;
    const inner = text.substring(open + 1, close).trim();
    const params =
        inner === "" || inner === "void"
            ? []
            : splitTopLevel(inner, ",").map(parseParam).filter((p) => p.raw !== "");
    return { raw, returnType, name, params, isStatic };
}

/** Name used to call a handle: "unsigned long millis()" -> "millis". */
export function callName(label: string): string {
    return parseSignature(label)?.name ?? label.trim().split(/\s+/).pop() ?? label;
}

/** Number of arguments a signature accepts: [required, maximum]. */
export function arity(sig: Signature): [number, number] {
    const required = sig.params.filter((p) => p.defaultValue === undefined).length;
    return [required, sig.params.length];
}

/**
 * Splits a block value into its elements: "1, 2, 3" -> ["1", "2", "3"], while
 * commas inside quotes or brackets are kept: "\"a, b\"" and "map(x, 0, 9)" are
 * one element each.
 */
export function splitValues(text: string): string[] {
    const parts: string[] = [];
    let depth = 0;
    let quote = "";
    let current = "";
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quote) {
            current += ch;
            if (ch === "\\") current += text[++i] ?? "";
            else if (ch === quote) quote = "";
            continue;
        }
        if (ch === '"' || ch === "'") quote = ch;
        else if ("([{".includes(ch)) depth++;
        else if (")]}".includes(ch)) depth = Math.max(0, depth - 1);
        if (ch === "," && depth === 0) {
            parts.push(current.trim());
            current = "";
        } else current += ch;
    }
    parts.push(current.trim());
    return parts;
}
