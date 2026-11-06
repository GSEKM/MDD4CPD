import { describe, expect, it } from "vitest";
import { generateCode } from "../../components/code/code";
import { makeNode, link } from "../../components/examples";

describe("model problems", () => {
    it("reports controllers, port range, arity, types and unused blocks", () => {
        const uno = makeNode("Arduino Uno", 0, 0);
        const nano = makeNode("Arduino Nano", 0, 300);
        const port = makeNode("Port", 200, 0, { value: "20" });
        const ms = makeNode("Parameter(s)", 200, 200, { value: "1000" }); // byte
        const io = makeNode("Digital I/O", 400, 0);
        const time = makeNode("Time", 400, 200);
        const servo = makeNode("Servo", 400, 400);
        const edges: any[] = [];
        link(edges, uno, "setup()", port, "in");
        link(edges, port, "out", io, "void pinMode(int pin, int mode)");
        link(edges, uno, "loop()", ms, "in");
        link(edges, ms, "out", time, "void delay(int ms)");
        const result = generateCode({ nodes: [uno, nano, port, ms, io, time, servo], edges });
        expect(result.problems.map((p) => p.message)).toMatchSnapshot();
        expect(result.code).toMatchSnapshot();
    });
});
