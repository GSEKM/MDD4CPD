import { describe, expect, it } from "vitest";
import { tidyLayout, COLUMN_GAP } from "../layout";
import { examples } from "../examples";
import { generateCode } from "../../generator/generate";

describe("tidy layout", () => {
    it("puts the controller first and follows the links left to right", () => {
        const model = examples[0].build(); // Blink
        const pos = tidyLayout(model.nodes as any, model.edges, generateCode(model).statements);
        const x = (name: string) => pos.get(model.nodes.find((n: any) => n.data.name === name)!.id)!.x;
        expect(x("Arduino Uno")).toBe(0);
        expect(x("LED_BUILTIN")).toBeGreaterThan(x("Arduino Uno"));
        expect(x("HIGH")).toBeGreaterThan(x("LED_BUILTIN"));
        expect(x("Digital I/O")).toBeGreaterThan(x("HIGH"));
        // same column: OUTPUT (used by statement 1) above HIGH above LOW
        const y = (name: string) => pos.get(model.nodes.find((n: any) => n.data.name === name)!.id)!.y;
        expect(x("OUTPUT")).toBe(x("HIGH"));
        expect(y("OUTPUT")).toBeLessThan(y("HIGH"));
        expect(y("HIGH")).toBeLessThan(y("LOW"));
        expect(COLUMN_GAP).toBeGreaterThan(0);
    });

    it("is deterministic and independent of the current positions' order", () => {
        const model = examples[1].build();
        const st = generateCode(model).statements;
        const a = tidyLayout(model.nodes as any, model.edges, st);
        const b = tidyLayout(JSON.parse(JSON.stringify(model.nodes)), model.edges, st);
        expect([...b.entries()]).toEqual([...a.entries()]);
    });
});
