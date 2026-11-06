import { describe, expect, it } from "vitest";
import { arity, callName, parseParam, parseSignature } from "../signature";
import { familyOf, incompatibility } from "../types";
import { CodeWriter } from "../writer";
import { generateCode } from "../generate";
import { link, makeNode } from "../../components/examples";

describe("signature", () => {
    it("parses return type, name and params", () => {
        const s = parseSignature("void pinMode(int pin, int mode)")!;
        expect(s.returnType).toBe("void");
        expect(s.name).toBe("pinMode");
        expect(s.params.map((p) => [p.type, p.name])).toEqual([["int", "pin"], ["int", "mode"]]);
    });
    it("handles multi-word types, pointers and defaults", () => {
        const s = parseSignature("bool begin(uint8_t mode = BMP085_ULTRAHIGHRES, TwoWire *wire = &Wire)")!;
        expect(s.params).toEqual([
            { raw: "uint8_t mode = BMP085_ULTRAHIGHRES", type: "uint8_t", name: "mode", defaultValue: "BMP085_ULTRAHIGHRES" },
            { raw: "TwoWire *wire = &Wire", type: "TwoWire*", name: "wire", defaultValue: "&Wire" },
        ]);
        expect(arity(s)).toEqual([0, 2]);
        expect(parseSignature("unsigned long millis()")!.returnType).toBe("unsigned long");
    });
    it("handles unnamed params, constructors and static methods", () => {
        const c = parseSignature("Stepper(int, int, int)")!;
        expect(c.returnType).toBe("");
        expect(c.params.map((p) => p.type)).toEqual(["int", "int", "int"]);
        const st = parseSignature("static void Foo::begin(long speed)")!;
        expect(st.isStatic).toBe(true);
        expect(st.name).toBe("begin");
        expect(parseParam("unsigned int").name).toBe("");
        expect(parseParam("char buf[]").type).toBe("char*");
    });
    it("is null for non-call labels", () => {
        expect(parseSignature("in")).toBeNull();
        expect(callName("int32_t readPressure()")).toBe("readPressure");
    });
});

describe("types", () => {
    it("classifies families", () => {
        expect(familyOf("unsigned long")).toBe("integer");
        expect(familyOf("const char *")).toBe("text");
        expect(familyOf("T")).toBe("generic");
        expect(familyOf("colorDataRaw")).toBe("other");
    });
    it("allows implicit numeric conversions but flags lossy/illegal ones", () => {
        expect(incompatibility("int", "byte")).toBeNull();
        expect(incompatibility("bool", "int")).toBeNull();
        expect(incompatibility("int", "float")).toMatch(/lost/);
        expect(incompatibility("int", "String")).toMatch(/incompatible/);
        expect(incompatibility("SomeStruct", "int")).toBeNull();
    });
});

describe("writer", () => {
    it("indents blocks structurally", () => {
        const w = new CodeWriter();
        w.block("if (a)", () => {
            w.line("x();");
            w.dedentLine("} else {");
            w.line("y();");
        });
        expect(w.toString()).toBe("if (a) {\n    x();\n} else {\n    y();\n}\n");
    });
});

describe("components", () => {
    it("puts constructor arguments in the object declaration", () => {
        const uno = makeNode("Arduino Uno", 0, 0);
        const steps = makeNode("Parameter(s)", 200, 0, { returnType: "int", value: "200,8,9" });
        const stepper = makeNode("Stepper", 400, 0);
        const edges: any[] = [];
        link(edges, uno, "setup()", steps, "in");
        link(edges, steps, "out", stepper, "Stepper(int, int, int)");
        const { code, problems } = generateCode({ nodes: [uno, steps, stepper], edges });
        expect(problems).toEqual([]);
        expect(code).toContain("Stepper stepper0(200, 8, 9);");
        expect(code).toMatch(/void setup\(\) \{\n\}/);
    });

    it("names instances per class, in block order", () => {
        const a = makeNode("Servo", 0, 0);
        const b = makeNode("Servo", 0, 100);
        const { code } = generateCode({ nodes: [makeNode("Arduino Uno", 0, 0), a, b], edges: [] });
        expect(code).toContain("Servo servo0;\nServo servo1;");
    });
});
