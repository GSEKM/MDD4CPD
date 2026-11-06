// Deterministic extraction of classes and their public methods from Arduino
// library headers (C++). This is not a full C++ parser: it applies a fixed set
// of rules, so the same header text always yields the same result.
//
// Rules:
//   1. comments are removed (string/char literals are kept intact), line
//      continuations are joined and preprocessor lines are dropped — code in
//      every #if branch is kept, duplicated methods are merged;
//   2. namespaces and extern "C" blocks are entered; class/struct definitions
//      are collected; class templates are skipped;
//   3. members are split at top-level ';' and '{...}' bodies, tracking the
//      public/protected/private sections (class: private by default,
//      struct: public by default);
//   4. a public member is kept when it is a function declaration or inline
//      definition; operators, destructors, deleted functions, copy/move
//      constructors, friends, typedefs, function pointers and names starting
//      with '_' are skipped;
//   5. classes inside namespaces named detail/details/internal/impl/private
//      are skipped, nested classes are only used for inheritance;
//   6. public base classes are resolved inside the library, plus Arduino's
//      Print and Stream (see coreBases); own methods come first, then
//      inherited ones, each list in source order.

export type ParsedClass = {
    name: string;
    nested: boolean; // defined inside another class (not usable as a block)
    header: string; // path of the header that defines it
    bases: string[]; // public bases
    methods: string[]; // normalised signatures, own first then inherited
    constructors: string[];
};

/** Public API of the Arduino core classes that libraries commonly extend. */
export const coreBases: Record<string, { bases: string[]; methods: string[] }> = {
    Print: {
        bases: [],
        methods: [
            "size_t write(uint8_t c)",
            "size_t write(const char *str)",
            "size_t write(const uint8_t *buffer, size_t size)",
            "size_t print(const String &s)",
            "size_t print(const char str[])",
            "size_t print(char c)",
            "size_t print(int n, int base = DEC)",
            "size_t print(long n, int base = DEC)",
            "size_t print(double n, int digits = 2)",
            "size_t println(const String &s)",
            "size_t println(const char str[])",
            "size_t println(char c)",
            "size_t println(int n, int base = DEC)",
            "size_t println(long n, int base = DEC)",
            "size_t println(double n, int digits = 2)",
            "size_t println(void)",
            "void flush()",
        ],
    },
    Stream: {
        bases: ["Print"],
        methods: [
            "int available()",
            "int read()",
            "int peek()",
            "void setTimeout(unsigned long timeout)",
            "bool find(char *target)",
            "long parseInt()",
            "float parseFloat()",
            "size_t readBytes(char *buffer, size_t length)",
            "String readString()",
            "String readStringUntil(char terminator)",
        ],
    },
};

// #region 1. Cleaning
export function stripComments(src: string): string {
    let out = "";
    let i = 0;
    while (i < src.length) {
        const c = src[i];
        const n = src[i + 1];
        if (c === "/" && n === "/") {
            while (i < src.length && src[i] !== "\n") i++;
        } else if (c === "/" && n === "*") {
            i += 2;
            while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) {
                if (src[i] === "\n") out += "\n";
                i++;
            }
            i += 2;
        } else if (c === '"' || c === "'") {
            const q = c;
            out += c;
            i++;
            while (i < src.length && src[i] !== q) {
                if (src[i] === "\\") out += src[i++];
                out += src[i++] ?? "";
            }
            out += src[i++] ?? "";
        } else {
            out += c;
            i++;
        }
    }
    return out;
}

export function clean(src: string): string {
    return stripComments(src.replace(/\r\n?/g, "\n"))
        .replace(/\\\n/g, " ")
        .split("\n")
        .filter((line) => !/^\s*#/.test(line))
        .join("\n")
        .replace(/__attribute__\s*\(\(.*?\)\)/g, " ")
        .replace(/\[\[[^\]]*\]\]/g, " ");
}
// #endregion

// #region 2-3. Scanning
type Statement = { text: string; body?: string };

/** Index of the brace matching the one at `open`. */
function matchBrace(text: string, open: number): number {
    let depth = 0;
    for (let i = open; i < text.length; i++) {
        const c = text[i];
        if (c === '"' || c === "'") {
            const q = c;
            for (i++; i < text.length && text[i] !== q; i++) if (text[i] === "\\") i++;
        } else if (c === "{") depth++;
        else if (c === "}" && --depth === 0) return i;
    }
    return text.length - 1;
}

/**
 * Splits a scope into statements at top-level ';' or '{...}', and at access
 * labels ("public:") which are returned as their own statement.
 */
function statements(text: string): Statement[] {
    const result: Statement[] = [];
    let current = "";
    let parens = 0;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '"' || c === "'") {
            const q = c;
            let lit = c;
            for (i++; i < text.length && text[i] !== q; i++) {
                if (text[i] === "\\") lit += text[i++];
                lit += text[i];
            }
            current += lit + q;
            continue;
        }
        if (c === "(") parens++;
        if (c === ")") parens = Math.max(0, parens - 1);
        if (parens === 0 && c === ":" && text[i + 1] !== ":" && text[i - 1] !== ":" &&
            /^\s*(public|protected|private)\s*$/.test(current)) {
            result.push({ text: current.trim() + ":" });
            current = "";
            continue;
        }
        if (parens === 0 && c === ";") {
            result.push({ text: current.trim() });
            current = "";
        } else if (c === "{" && (parens === 0 || /=\s*$/.test(current))) {
            const end = matchBrace(text, i);
            result.push({ text: current.trim(), body: text.substring(i + 1, end) });
            current = "";
            i = end;
            // a definition may be followed by ';' (class, enum, initialiser)
            const rest = text.substring(i + 1).match(/^\s*;/);
            if (rest) i += rest[0].length;
        } else current += c;
    }
    if (current.trim()) result.push({ text: current.trim() });
    return result;
}
// #endregion

// #region 4. Members
const classHead = /(?:^|\s)(class|struct)\s+(?:[A-Z_][A-Z0-9_]*\s+)?([A-Za-z_]\w*)\s*(?:final\s*)?(?::\s*([\s\S]*))?$/;

function normalizeSpaces(s: string) {
    return s
        .replace(/\s+/g, " ")
        .replace(/\s*([(),])\s*/g, "$1")
        .replace(/,/g, ", ")
        .replace(/\(\s*/g, "(")
        .replace(/\s*\)/g, ")")
        .trim();
}

/** Index of the ')' matching the '(' at `open`. */
function matchParen(text: string, open: number) {
    let depth = 0;
    for (let i = open; i < text.length; i++) {
        if (text[i] === "(") depth++;
        else if (text[i] === ")" && --depth === 0) return i;
    }
    return -1;
}

/** Turns a member declaration into a signature, or null if it is skipped. */
export function memberSignature(decl: string, className: string): string | null {
    let d = decl.replace(/\s+/g, " ").trim();
    if (/^(friend|typedef|using|template|static_assert|enum|union|class|struct)\b/.test(d)) return null;
    if (/\boperator\b/.test(d) || /~/.test(d)) return null;
    d = d.replace(/\b(virtual|inline|explicit|constexpr|extern|ICACHE_RAM_ATTR|IRAM_ATTR)\b/g, " ").trim();
    let isStatic = false;
    if (/^static\b/.test(d)) {
        isStatic = true;
        d = d.replace(/^static\b/, "").trim();
    }
    const open = d.indexOf("(");
    if (open <= 0) return null;
    const close = matchParen(d, open);
    if (close === -1) return null;
    const head = d.substring(0, open).trim();
    const nameMatch = head.match(/([A-Za-z_]\w*)$/);
    if (!nameMatch) return null; // function pointer, macro call, ...
    const name = nameMatch[1];
    // attribute-like macros (FASTLED_FORCE_INLINE, ICACHE_FLASH_ATTR, ...) are not types
    const returnType = head
        .substring(0, head.length - name.length)
        .split(/\s+/)
        .filter((t) => !/^[A-Z][A-Z0-9]*_[A-Z0-9_]+$/.test(t))
        .join(" ")
        .trim();
    const tail = d.substring(close + 1);
    if (/=\s*delete\b/.test(tail)) return null;
    if (name.startsWith("_")) return null;
    const params = d.substring(open + 1, close).trim();
    const isConstructor = name === className && returnType === "";
    if (!isConstructor && (returnType === "" || /[=(]/.test(returnType))) return null;
    if (isConstructor && new RegExp(`^(const\\s+)?${className}\\s*&{1,2}\\s*\\w*$`).test(params)) return null;
    // a variable initialised with a call, e.g. "Foo bar(1, 2)" has no type in params,
    // but cannot be told apart from a declaration: both are kept as methods by C++ too.
    const sig = `${isStatic ? "static " : ""}${returnType ? returnType + " " : ""}${name}(${params === "void" ? "" : params})`;
    return normalizeSpaces(sig).replace(/\s*\*\s*/g, " *").replace(/\* \*/g, "**").replace(/\s*&\s*/g, " &").replace(/\( \*/g, "(*").replace(/ \)/g, ")");
}

type RawClass = {
    name: string;
    header: string;
    nested: boolean;
    bases: string[];
    methods: string[];
    constructors: string[];
};

const privateNamespace = /^(detail|details|internal|impl|private|priv)$/i;

function parseBases(text: string | undefined): string[] {
    if (!text) return [];
    return text
        .split(",")
        .map((b) => b.trim())
        .filter((b) => /^public\b/.test(b) || !/^(private|protected)\b/.test(b))
        .map((b) => b.replace(/^(public|virtual|\s)+/g, "").replace(/<.*$/, "").trim())
        .map((b) => b.split("::").pop()!)
        .filter(Boolean);
}

function parseClassBody(
    name: string,
    kind: string,
    body: string,
    header: string,
    out: RawClass[],
    bases: string[],
    nested = false,
) {
    const cls: RawClass = { name, header, nested, bases, methods: [], constructors: [] };
    let access = kind === "struct" ? "public" : "private";
    for (const st of statements(body)) {
        const label = st.text.match(/^(public|protected|private):$/);
        if (label) {
            access = label[1];
            continue;
        }
        // nested classes are collected on their own, whatever their access
        const nested = st.body !== undefined && st.text.match(classHead);
        if (nested && !/\btemplate\b/.test(st.text) && !/\(/.test(st.text)) {
            if (access === "public")
                parseClassBody(nested[2], nested[1], st.body!, header, out, parseBases(nested[3]), true);
            continue;
        }
        if (access !== "public") continue;
        // inline definitions: drop a constructor's initialiser list
        let text = st.text;
        if (st.body !== undefined) {
            const open = text.indexOf("(");
            const close = open >= 0 ? matchParen(text, open) : -1;
            if (close > 0) text = text.substring(0, close + 1) + text.substring(close + 1).replace(/:[\s\S]*$/, "");
        }
        const sig = memberSignature(text, name);
        if (!sig) continue;
        const list = sig.startsWith(name + "(") ? cls.constructors : cls.methods;
        if (!list.includes(sig)) list.push(sig);
    }
    out.push(cls);
}

function scanScope(text: string, header: string, out: RawClass[]) {
    for (const st of statements(text)) {
        if (st.body === undefined) continue;
        const ns = st.text.match(/^(?:inline\s+)?namespace\b\s*([\w:]*)\s*$/);
        if (ns) {
            if (!ns[1].split("::").some((n) => privateNamespace.test(n))) scanScope(st.body, header, out);
            continue;
        }
        if (/^extern\s*"C\+?\+?"$/.test(st.text)) {
            scanScope(st.body, header, out);
            continue;
        }
        if (/\btemplate\s*</.test(st.text)) continue;
        const m = st.text.match(classHead);
        if (m && !/\(/.test(st.text.replace(/:[\s\S]*$/, ""))) parseClassBody(m[2], m[1], st.body, header, out, parseBases(m[3]));
    }
}
// #endregion

// #region 5. Library-level resolution
/** Parses every header of a library and resolves public inheritance. */
export function parseHeaders(files: { path: string; text: string }[]): ParsedClass[] {
    const raw: RawClass[] = [];
    for (const f of files) scanScope(clean(f.text), f.path, raw);

    // merge classes declared in several #if branches or headers (first wins for header)
    const byName = new Map<string, RawClass>();
    for (const c of raw) {
        const prev = byName.get(c.name);
        if (!prev) byName.set(c.name, { ...c, methods: [...c.methods], constructors: [...c.constructors] });
        else {
            c.methods.forEach((m) => prev.methods.includes(m) || prev.methods.push(m));
            c.constructors.forEach((m) => prev.constructors.includes(m) || prev.constructors.push(m));
            c.bases.forEach((b) => prev.bases.includes(b) || prev.bases.push(b));
        }
    }

    const inherited = (name: string, seen: Set<string>): string[] => {
        if (seen.has(name)) return [];
        seen.add(name);
        const own = byName.get(name) ?? coreBases[name];
        if (!own) return [];
        const result = [...own.methods];
        for (const b of own.bases) inherited(b, seen).forEach((m) => result.includes(m) || result.push(m));
        return result;
    };

    return [...byName.values()].map((c) => ({
        name: c.name,
        header: c.header,
        nested: c.nested,
        bases: c.bases,
        constructors: c.constructors,
        methods: inherited(c.name, new Set()),
    }));
}
// #endregion
