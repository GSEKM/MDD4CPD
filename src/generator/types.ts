// Arduino-aware type compatibility used to check call arguments.
//
// Arduino code relies on implicit numeric conversions (passing a byte to an
// int parameter is fine), so only conversions that are illegal or lossy are
// reported. Unknown types (structs, enums, library typedefs) are not judged.

export type Family = "integer" | "float" | "bool" | "text" | "pointer" | "generic" | "other";

const integers = new Set([
    "byte", "char", "short", "int", "long", "word", "size_t",
    "unsigned", "unsigned char", "unsigned short", "unsigned int", "unsigned long",
    "signed char", "long long", "unsigned long long",
    "uint8_t", "uint16_t", "uint32_t", "uint64_t", "int8_t", "int16_t", "int32_t", "int64_t",
]);
const floats = new Set(["float", "double"]);
const bools = new Set(["bool", "boolean"]);
const texts = new Set(["String", "string", "const char*", "char*"]);
const generics = new Set(["", "T", "<T>", "?", "any", "any?", "auto", "bits"]);

export function normalizeType(type: string): string {
    return type
        .replace(/&/g, "")
        .replace(/\s*\*\s*/g, "*")
        .replace(/\s+/g, " ")
        .trim();
}

export function familyOf(type: string): Family {
    const t = normalizeType(type);
    const bare = t.replace(/^const /, "");
    if (generics.has(bare)) return "generic";
    if (texts.has(t) || texts.has(bare)) return "text";
    if (t.endsWith("*")) return "pointer";
    if (integers.has(bare)) return "integer";
    if (floats.has(bare)) return "float";
    if (bools.has(bare)) return "bool";
    return "other";
}

/**
 * Returns null when a value of type `received` can be passed where `expected`
 * is required, otherwise a short reason.
 */
export function incompatibility(expected: string, received: string): string | null {
    const e = familyOf(expected);
    const r = familyOf(received);
    if (e === "generic" || r === "generic" || e === "other" || r === "other") return null;
    const numeric = ["integer", "float", "bool"];
    if (numeric.includes(e) && numeric.includes(r)) {
        if (r === "float" && e === "integer") return "the decimal part will be lost";
        return null;
    }
    if (e === r) return null;
    return "incompatible types";
}
