// Arduino Library Manager index client and library importer.
//
// Everything here is deterministic given the index: the latest version of a
// library is chosen by version order, archives are verified against the
// index's SHA-256 checksum, and palette blocks are derived from the headers by
// headerParser.ts. Both endpoints send CORS headers, so this runs in the
// browser without a proxy.

import { unzipSync, strFromU8 } from "fflate";
import { parseHeaders, type ParsedClass } from "./headerParser";
import { sha256Hex } from "./sha256";

export const INDEX_URL = "https://downloads.arduino.cc/libraries/library_index.json.gz";

export type LibraryEntry = {
    name: string;
    version: string;
    author: string;
    sentence: string;
    category: string;
    website: string;
    url: string;
    checksum: string; // "SHA-256:<hex>"
    size: number;
    architectures: string[];
    providesIncludes: string[];
};

export type PaletteNode = {
    name: string;
    color: string;
    extras: Record<string, any>;
    methods: string[];
};

export type ImportedLibrary = {
    name: string;
    version: string;
    checksum: string;
    includes: string[];
    components: PaletteNode[];
};

// #region Index
/** Numeric-aware version comparison ("1.10.0" > "1.9.2"). */
export function compareVersions(a: string, b: string): number {
    const pa = a.split(/[.\-+]/);
    const pb = b.split(/[.\-+]/);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const x = pa[i] ?? "0";
        const y = pb[i] ?? "0";
        const nx = Number(x);
        const ny = Number(y);
        if (!Number.isNaN(nx) && !Number.isNaN(ny)) {
            if (nx !== ny) return nx - ny;
        } else if (x !== y) return x < y ? -1 : 1;
    }
    return 0;
}

/** The fields we use from a raw index entry. */
export function toEntry(l: any): LibraryEntry {
    return {
        name: l.name,
        version: l.version,
        author: l.author ?? "",
        sentence: l.sentence ?? "",
        category: l.category ?? "",
        website: l.website ?? "",
        url: l.url,
        checksum: l.checksum ?? "",
        size: l.size ?? 0,
        architectures: l.architectures ?? [],
        providesIncludes: l.providesIncludes ?? [],
    };
}

/** Keeps the latest version of each library, sorted by name. */
export function latestVersions(raw: any[]): LibraryEntry[] {
    const latest = new Map<string, any>();
    for (const l of raw) {
        const prev = latest.get(l.name);
        if (!prev || compareVersions(l.version, prev.version) > 0) latest.set(l.name, l);
    }
    return [...latest.values()].map(toEntry).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** Downloads the raw index (every version of every library). */
export async function loadRawIndex(fetchImpl: typeof fetch = fetch): Promise<any[]> {
    const res = await fetchImpl(INDEX_URL);
    if (!res.ok || !res.body) throw new Error(`Library index: HTTP ${res.status}`);
    const stream = res.body.pipeThrough(new DecompressionStream("gzip"));
    return (await new Response(stream).json()).libraries;
}

let indexPromise: Promise<LibraryEntry[]> | null = null;

/** Downloads (once per session) and decompresses the library index. */
export function loadIndex(fetchImpl: typeof fetch = fetch): Promise<LibraryEntry[]> {
    indexPromise ??= loadRawIndex(fetchImpl).then(latestVersions);
    indexPromise.catch(() => (indexPromise = null));
    return indexPromise;
}

/** Deterministic ranking: exact, prefix, word, substring, then description. */
export function searchIndex(index: LibraryEntry[], query: string, limit = 50): LibraryEntry[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const scored: [number, LibraryEntry][] = [];
    for (const l of index) {
        const name = l.name.toLowerCase();
        let score = -1;
        if (name === q) score = 0;
        else if (name.startsWith(q)) score = 1;
        else if (name.split(/[^a-z0-9]+/).includes(q)) score = 2;
        else if (name.includes(q)) score = 3;
        else if (l.sentence.toLowerCase().includes(q)) score = 4;
        if (score >= 0) scored.push([score, l]);
    }
    scored.sort((a, b) => a[0] - b[0] || a[1].name.length - b[1].name.length || (a[1].name < b[1].name ? -1 : 1));
    return scored.slice(0, limit).map((s) => s[1]);
}
// #endregion

/**
 * The library that provides a header. Ranking (deterministic):
 *   0. named like the header ("Servo.h" -> "Servo", "Adafruit_BMP085.h" ->
 *      "Adafruit BMP085 Library") — not every library fills providesIncludes;
 *   1. lists the header first in providesIncludes;
 *   2. lists it anywhere in providesIncludes;
 * then the exact name, the shortest name, alphabetical.
 */
export function findLibraryForHeader(index: LibraryEntry[], header: string): LibraryEntry | null {
    const base = header.replace(/\.(h|hpp)$/i, "");
    const norm = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, "").replace(/library$/, "");
    const score = (l: LibraryEntry) =>
        norm(l.name) === norm(base) ? 0 : l.providesIncludes[0] === header ? 1 : l.providesIncludes.includes(header) ? 2 : -1;
    const candidates = index.filter((l) => score(l) >= 0);
    candidates.sort(
        (a, b) =>
            score(a) - score(b) ||
            Number(b.name === base) - Number(a.name === base) ||
            a.name.length - b.name.length ||
            (a.name < b.name ? -1 : 1),
    );
    return candidates[0] ?? null;
}

// #region Archive
export function parseProperties(text: string): Record<string, string> {
    const props: Record<string, string> = {};
    text.split(/\r?\n/).forEach((line) => {
        const m = line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/);
        if (m) props[m[1]] = m[2];
    });
    return props;
}

type LibraryFiles = { properties: Record<string, string>; headers: { path: string; text: string }[] };

/** Headers of an unzipped library: src/ (1.5 layout) or the root (1.0 layout). */
export function libraryFiles(files: Record<string, Uint8Array>): LibraryFiles {
    const paths = Object.keys(files).filter((p) => !p.endsWith("/"));
    const root = paths.length ? paths[0].split("/")[0] + "/" : "";
    const rel = (p: string) => (p.startsWith(root) ? p.substring(root.length) : p);
    const propsPath = paths.find((p) => rel(p) === "library.properties");
    const properties = propsPath ? parseProperties(strFromU8(files[propsPath])) : {};
    const hasSrc = paths.some((p) => rel(p).startsWith("src/"));
    const headers = paths
        .filter((p) => /\.(h|hpp)$/i.test(p) && !/\.cpp\.hpp$/i.test(p))
        .map((p) => ({ full: p, path: rel(p) }))
        .filter(({ path }) =>
            hasSrc ? path.startsWith("src/") : !path.includes("/") || path.startsWith("utility/"),
        )
        .map(({ full, path }) => ({ path: hasSrc ? path.substring(4) : path, text: strFromU8(files[full]) }))
        .sort((a, b) => (a.path < b.path ? -1 : 1));
    return { properties, headers };
}
// #endregion

// #region Palette
/** Builds palette blocks from the parsed classes of a library. */
export function toPalette(lib: LibraryEntry, files: LibraryFiles, classes: ParsedClass[]): ImportedLibrary {
    const includes = (files.properties.includes || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const main = includes[0] ?? files.headers.find((h) => h.path === `${lib.name}.h`)?.path;
    const headerOrder = (h: string) => {
        const i = includes.indexOf(h);
        return i >= 0 ? i : includes.length + files.headers.findIndex((f) => f.path === h);
    };
    // Blocks: top-level classes with at least one public method. Classes of
    // top-level headers are preferred; nested headers are only used when the
    // top level defines none (deterministic fallback).
    const usable = classes.filter((c) => !c.nested && c.methods.length > 0);
    const topLevel = usable.filter((c) => !c.header.includes("/"));
    const components = (topLevel.length > 0 ? topLevel : usable)
        .sort((a, b) => headerOrder(a.header) - headerOrder(b.header))
        .map((c) => ({
            name: c.name,
            color: "orange",
            extras: {
                type: "component",
                // nested headers are reached through the main header
                library: includes.includes(c.header) || !c.header.includes("/") || !main ? c.header : main,
                className: c.name,
                packageName: lib.name,
                version: lib.version,
                checksum: lib.checksum,
                link: lib.website,
                description: lib.sentence,
                source: "arduino-library-index",
            },
            methods: [...c.constructors, ...c.methods],
        }));
    return { name: lib.name, version: lib.version, checksum: lib.checksum, includes, components };
}

/** Downloads, verifies and parses one library. */
export async function importLibrary(lib: LibraryEntry, fetchImpl: typeof fetch = fetch): Promise<ImportedLibrary> {
    const res = await fetchImpl(lib.url);
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
    const data = new Uint8Array(await res.arrayBuffer());
    const [algo, expected] = lib.checksum.split(":");
    if (algo === "SHA-256" && expected) {
        const actual = await sha256Hex(data);
        if (actual !== expected.toLowerCase()) throw new Error("Checksum mismatch: archive does not match the index");
    }
    const files = libraryFiles(unzipSync(data));
    if (files.headers.length === 0) throw new Error("No headers found in the library");
    return toPalette(lib, files, parseHeaders(files.headers));
}
// #endregion
