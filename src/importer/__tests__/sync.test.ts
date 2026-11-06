import { describe, expect, it } from "vitest";
import { evaluateEdit, mergeDiagram } from "../sync";
import { importSketch } from "../ino";
import { generateCode } from "../../generator/generate";
import { examples } from "../../components/examples";
import { builtInPalette } from "../../palette";

const blink = () => {
    const d = examples[0].build();
    // as on the canvas: dropped blocks are centred horizontally
    d.nodes.forEach((n: any, k: number) => {
        n.origin = [0.5, 0];
        n.computed = { width: 200, height: 100 };
        n.position = { x: 1000 + 300 * k, y: 50 * k };
    });
    return d;
};

describe("code edits", () => {
    it("leaves the canvas alone when the code is unchanged", () => {
        const d = blink();
        expect(evaluateEdit(generateCode(d).code, d, builtInPalette).kind).toBe("unchanged");
        // formatting only
        const messy = generateCode(d).code.replace(/  /g, "\t").replace(/;/g, " ;");
        expect(evaluateEdit(messy, d, builtInPalette).kind).toBe("unchanged");
    });

    it("applies an edit, keeping ids and positions of the blocks it keeps", () => {
        const d = blink();
        const code = generateCode(d).code.replace("delay(1000);", "delay(250);");
        const out = evaluateEdit(code, d, builtInPalette);
        expect(out.kind).toBe("apply");
        if (out.kind !== "apply") return;
        expect(out.code).toContain("delay(250);");
        const { diagram } = out.merge;
        // the generated code of the merged diagram is what the code says
        expect(generateCode(diagram).code).toBe(out.code);
        const before = new Map(d.nodes.map((n: any) => [n.id, n]));
        const kept = diagram.nodes.filter((n) => before.has(n.id));
        expect(kept.length).toBeGreaterThanOrEqual(d.nodes.length - 1);
        kept.forEach((n: any) => {
            expect(n.position).toEqual(before.get(n.id)!.position);
            expect(n.origin).toEqual([0.5, 0]);
        });
    });

    it("adds new blocks next to the blocks they are linked to", () => {
        const d = blink();
        const code = generateCode(d).code.replace(/void loop\(\) \{\n/, 'void loop() {\n  Serial.println("tick");\n');
        const out = evaluateEdit(code, d, builtInPalette);
        expect(out.kind).toBe("apply");
        if (out.kind !== "apply") return;
        expect(out.merge.added).toBeGreaterThan(0);
        expect(generateCode(out.merge.diagram).code).toContain('Serial.println("tick");');
        const ids = new Set(d.nodes.map((n: any) => n.id));
        out.merge.diagram.nodes
            .filter((n) => !ids.has(n.id))
            .forEach((n) => {
                // near the existing layout, not at the importer's origin
                expect(n.position!.x).toBeGreaterThan(500);
            });
    });

    it("blocks edits that the block language cannot express", () => {
        const d = blink();
        const code = generateCode(d).code.replace(/void loop\(\) \{\n/, "void loop() {\n  for (int i = 0; i < 3; i++) delay(1);\n");
        const out = evaluateEdit(code, d, builtInPalette);
        expect(out.kind).toBe("blocked");
        if (out.kind === "blocked") expect(out.reasons[0].message).toMatch(/for/);
    });

    it("blocks half-typed code", () => {
        const d = blink();
        const code = generateCode(d).code;
        for (const broken of [
            code.replace("delay(1000);", "delay(1000"),
            code.replace("delay(1000);", "dela(1000);"),
            code.replace(/\}\s*$/, ""),
            code.replace("delay(1000);", "delay(1000,"),
        ]) {
            expect(evaluateEdit(broken, d, builtInPalette).kind, broken).toBe("blocked");
        }
    });

    it("matches blocks without a custom name by kind", () => {
        const servo = examples.find((e) => /servo/i.test(e.name))!.build();
        const code = generateCode(servo).code;
        const renamed = code.replace(/\bservo0\b/g, "arm");
        const out = evaluateEdit(renamed, servo, builtInPalette);
        expect(out.kind).toBe("apply");
        if (out.kind !== "apply") return;
        const ids = new Set(servo.nodes.map((n: any) => n.id));
        expect(out.merge.diagram.nodes.every((n) => ids.has(n.id))).toBe(true);
        expect(generateCode(out.merge.diagram).code).toContain("Servo arm;");
    });

    it("is deterministic", () => {
        const d = blink();
        const code = generateCode(d).code.replace("delay(1000);", 'delay(5);\n  Serial.println("x");');
        const a = mergeDiagram(d, importSketch(code, builtInPalette).diagram);
        const b = mergeDiagram(d, importSketch(code, builtInPalette).diagram);
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });
});

describe("placement", () => {
    it("does not put new blocks on top of existing ones", () => {
        const d = blink();
        const code = generateCode(d).code.replace("delay(1000);", 'delay(7);\n    Serial.println("a");\n    Serial.println(3.5);');
        const out = evaluateEdit(code, d, builtInPalette);
        if (out.kind !== "apply") throw new Error(out.kind);
        const box = (n: any) => {
            const w = n.computed?.width ?? 200;
            const h = n.computed?.height ?? 100;
            const [ox, oy] = n.origin ?? [0, 0];
            return { x: n.position.x - ox * w, y: n.position.y - oy * h, w, h };
        };
        const ids = new Set(d.nodes.map((n: any) => n.id));
        const all = out.merge.diagram.nodes.map((n: any) => ({ id: n.id, ...box(ids.has(n.id) ? { ...n, computed: { width: 200, height: 100 } } : n) }));
        const fresh = all.filter((b) => !ids.has(b.id));
        expect(fresh.length).toBeGreaterThan(0);
        for (const a of fresh)
            for (const b of all)
                if (a !== b) {
                    const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
                    expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
                }
    });
});
