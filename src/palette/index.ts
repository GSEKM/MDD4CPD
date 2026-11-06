// The built-in palette: hand-written core blocks (controllers, values, logic,
// Arduino core functions and constants) plus component blocks generated from
// pinned library versions (see scripts/build-palette.ts).
import core from "../nodes.json";
import generated from "./components.generated.json";

export const builtInPalette: any[] = [...core, ...generated];
