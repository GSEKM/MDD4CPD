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

The generator lives in `components/code/code.ts` (port of the legacy React tool,
rzfzr/MDD4CPD-Legacy `src/components/Code.tsx`).
