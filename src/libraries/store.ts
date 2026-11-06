// Libraries imported from the Arduino Library Manager, kept in browser storage.
import { derived, writable } from "svelte/store";
import { builtInPalette } from "../palette";
import { findLibraryForHeader, importLibrary, loadIndex, type ImportedLibrary } from "./importer";

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
    ...builtInPalette,
    ...libs.flatMap((l) => l.components),
]);

/**
 * Imports, from the Arduino Library Manager, the library that provides each
 * header. Returns the problems (empty when everything was imported).
 */
export async function importLibrariesFor(
    headers: string[],
    onStatus: (status: string) => void = () => {},
): Promise<string[]> {
    const failed: string[] = [];
    try {
        onStatus("Loading the Arduino library index…");
        const index = await loadIndex();
        for (const header of headers) {
            const lib = findLibraryForHeader(index, header);
            if (!lib) {
                failed.push(`${header} (no library provides it)`);
                continue;
            }
            onStatus(`Importing ${lib.name} ${lib.version} for ${header}…`);
            try {
                const imported = await importLibrary(lib);
                if (!imported.components.some((c) => c.extras.library === header))
                    failed.push(`${lib.name} ${lib.version} does not provide ${header}`);
                addLibrary(imported);
            } catch (e: any) {
                failed.push(`${header}: ${e?.message || e}`);
            }
        }
    } catch (e: any) {
        failed.push(e?.message || String(e));
    }
    return failed;
}
