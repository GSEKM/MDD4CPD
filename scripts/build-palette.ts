// Regenerates src/palette/components.generated.json from the library versions
// pinned in src/palette/pinned-libraries.json:
//
//   npm run build:palette
//
// Each archive is verified against the index checksum and parsed with the same
// deterministic header parser the editor uses, so the built-in component
// blocks are derived from library code rather than written by hand.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { importLibrary, loadRawIndex, toEntry } from "../src/libraries/importer";

const dir = fileURLToPath(new URL("../src/palette/", import.meta.url));
const pinned: { name: string; version: string }[] = JSON.parse(readFileSync(dir + "pinned-libraries.json", "utf8"));

const raw = await loadRawIndex();
const components: any[] = [];
for (const pin of pinned) {
    const entry = raw.find((l) => l.name === pin.name && l.version === pin.version);
    if (!entry) throw new Error(`${pin.name} ${pin.version} is not in the library index`);
    const lib = await importLibrary(toEntry(entry));
    console.log(`${lib.name} ${lib.version}: ${lib.components.map((c) => c.name).join(", ")}`);
    components.push(...lib.components);
}
writeFileSync(dir + "components.generated.json", JSON.stringify(components, null, 4) + "\n");
console.log(`wrote ${components.length} component blocks`);
