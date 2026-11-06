import { describe, expect, it } from "vitest";
import { generateCode } from "../generate";
import { examples } from "../../components/examples";

describe("examples", () => {
    for (const ex of examples) {
        it(`${ex.name} generates the expected sketch`, () => {
            const result = generateCode(ex.build());
            expect(result.problems).toEqual([]);
            expect(result.code).toMatchSnapshot();
        });
    }

    it("is deterministic: same model, same output", () => {
        for (const ex of examples) {
            const model = ex.build();
            const a = generateCode(model);
            const b = generateCode(JSON.parse(JSON.stringify(model)));
            expect(b).toEqual(a);
        }
    });
});
