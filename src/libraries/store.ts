// Libraries imported from the Arduino Library Manager, kept in browser storage.
import { derived, writable } from "svelte/store";
import builtIn from "../nodes.json";
import type { ImportedLibrary } from "./importer";

const KEY = "mdd4cpd:libraries";

function initial(): ImportedLibrary[] {
    try {
        return JSON.parse(localStorage.getItem(KEY) || "[]");
    } catch {
        return [];
    }
}

export const importedLibraries = writable<ImportedLibrary[]>(initial());

importedLibraries.subscribe((libs) => {
    try {
        localStorage.setItem(KEY, JSON.stringify(libs));
    } catch {
        /* storage unavailable */
    }
});

export function addLibrary(lib: ImportedLibrary) {
    importedLibraries.update((libs) => [...libs.filter((l) => l.name !== lib.name), lib]);
}

export function removeLibrary(name: string) {
    importedLibraries.update((libs) => libs.filter((l) => l.name !== name));
}

/** Unique palette key: imported classes may share a name with built-in ones. */
export const paletteKey = (n: any) => `${n.name}|${n.extras?.packageName ?? ""}`;

/** Built-in blocks followed by the blocks of every imported library. */
export const palette = derived(importedLibraries, (libs) => [
    ...(builtIn as any[]),
    ...libs.flatMap((l) => l.components),
]);
