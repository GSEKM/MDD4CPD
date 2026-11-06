### Using the editor

Code is regenerated on every change of the diagram (right panel).

1. Drop a micro-controller: its `setup()` / `loop()` handles are the lifecycle methods.
2. Each link leaving `setup()` / `loop()` becomes one statement, in the order the links were created.
3. A link may pass through value nodes (Port, Parameter(s), Variable(s), Constant(s),
   `HIGH`, `OUTPUT`, ...) before reaching a method; those values become the call's arguments.
   Example (Blink): `loop() -> Port 13 -> HIGH -> digitalWrite`, `loop() -> Parameter 1000 -> delay`.
4. Use **usages +** on a value node to reuse it in another statement (adds an `in-k`/`out-k` pair).
5. Conditions/loops: route a value into `set(T xValue)` as the statement and link the other
   operand into `set(T yValue)`; `body`/`else` lead to the inner statements.
6. Functions are declared globally; link into `in` to call them and from `body` to fill them.

#### Editing the code

**Edit** (code panel) turns the sketch into an editor; the canvas follows the code.
After a short pause (or `Ctrl+S`) the code is read by the `.ino` importer and merged
into the diagram (`importer/sync.ts`):

- blocks the code still describes keep their id and position, matched by palette
  name and identity in the code (instance, variable, constant or function name,
  value), then by kind; new blocks go next to the block they are linked to, below
  any block they would cover;
- if a part of the code has no block equivalent (`for`, unknown calls, unclosed
  brackets, an `#include` no block provides ...) the canvas is left as it is and
  the lines are listed, with **Import** for missing libraries and **Apply the rest**
  to update the canvas without those parts;
- edits on the canvas while editing replace the code if it was in sync;
- **Revert** restores the diagram from before editing; **Done** shows the generated
  code again (normalised: constants in upper case, header comment, sections).

### Architecture

```
Arduino Library Manager --importer--> header parser --> component blocks --> palette
                                                                              |
diagram (nodes + links) <------------------ drag / Ctrl+K --------------------+
        |
        +--> generator --> Arduino sketch + problems
```

- `generator/` — deterministic code generator (semantics of the legacy React tool,
  rzfzr/MDD4CPD-Legacy `src/components/Code.tsx`): `graph.ts` (indexed diagram),
  `signature.ts` (C signatures), `types.ts` (argument checks), `writer.ts`
  (indentation), `problems.ts`, `generate.ts`.
- `libraries/headerParser.ts` — rule-based extraction of public classes/methods
  from library headers (rules documented at the top of the file).
- `libraries/importer.ts` — library index search, download, SHA-256 check, unzip.
- `importer/ino.ts` — deterministic .ino -> diagram conversion (the inverse of the
  generator; supported subset and ordering rules at the top of the file). Generated
  sketches round-trip exactly; unsupported constructs are reported with line numbers.
- `importer/sync.ts` — applies edited code to the canvas (block matching, placement
  of new blocks, when an edit is applied).
- `palette/` — built-in palette: `nodes.json` (core blocks, hand-written) plus
  `components.generated.json`, produced by `npm run build:palette` from the
  versions pinned in `pinned-libraries.json`.

### Determinism

No step uses randomness, clocks or language models. The sketch is a pure function
of the diagram: blocks and links keep their creation order, which fixes instance
names (`servo0`, `servo1`) and statement order. Imported blocks are a pure function
of the library archive, which is pinned by version and verified by checksum.
`npm test` runs the golden tests (`generator/__tests__`, `libraries/__tests__`).

Known limitation: libraries that hide their namespaces behind preprocessor macros
(e.g. ArduinoJson) expose internal classes, since the parser does not expand macros.
