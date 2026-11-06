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
