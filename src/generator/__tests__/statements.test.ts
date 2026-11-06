import { describe, expect, it } from "vitest";
import { generateCode } from "../generate";
import { examples } from "../../components/examples";

describe("statement trace", () => {
    it("maps every statement of Blink to its links, blocks and code lines", () => {
        const model = examples[0].build();
        const { code, statements } = generateCode(model);
        const lines = code.split("\n");
        const uno = model.nodes[0].id;
        const summary = statements.map((s) => ({
            from: `${s.sourceNodeId === uno ? "uno" : s.sourceNodeId}:${s.sourceHandleId}`,
            order: s.order,
            links: s.edgeIds.length,
            code: s.lines.map((l) => lines[l].trim()),
        }));
        expect(summary).toEqual([
            { from: "uno:source-0", order: 1, links: 3, code: ["pinMode(LED_BUILTIN, OUTPUT);"] },
            { from: "uno:source-1", order: 1, links: 3, code: ["digitalWrite(LED_BUILTIN, HIGH);"] },
            { from: "uno:source-1", order: 2, links: 2, code: ["delay(1000);"] },
            { from: "uno:source-1", order: 3, links: 3, code: ["digitalWrite(LED_BUILTIN, LOW);"] },
            { from: "uno:source-1", order: 4, links: 2, code: ["delay(1000);"] },
        ]);
        // every link of the diagram belongs to exactly one statement
        const all = statements.flatMap((s) => s.edgeIds).sort();
        expect(all).toEqual(model.edges.map((e) => e.id).sort());
    });

    it("tags nested statements separately from their condition", () => {
        const { code, statements } = generateCode(examples[1].build());
        const lines = code.split("\n");
        const byCode = (t: string) => statements.find((s) => s.lines.some((l) => lines[l].includes(t)))!;
        const cond = byCode("if (angle < LIMIT)");
        expect(cond.lines.map((l) => lines[l].trim())).toEqual(["if (angle < LIMIT) {", "}"]);
        expect(byCode("waitHalf();").id).not.toBe(cond.id);
    });
});
