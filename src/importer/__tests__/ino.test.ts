import { describe, expect, it } from "vitest";
import { importSketch, render, tokenize } from "../ino";
import { generateCode } from "../../generator/generate";
import { examples } from "../../components/examples";
import { builtInPalette } from "../../palette";

const roundTrip = (code: string) => {
    const imp = importSketch(code, builtInPalette);
    return { imp, out: generateCode(imp.diagram) };
};

describe("tokens", () => {
    it("renders expressions with conventional spacing", () => {
        const r = (s: string) => render(tokenize(s));
        expect(r("x+1")).toBe("x + 1");
        expect(r("delay( -1 )")).toBe("delay(-1)");
        expect(r('f(a,"b,c")')).toBe('f(a, "b,c")');
        expect(r("!done&&a[2]")).toBe("!done && a[2]");
        expect(r("obj.read()")).toBe("obj.read()");
    });
});

describe(".ino import", () => {
    for (const ex of examples) {
        it(`round-trips the ${ex.name} example exactly`, () => {
            const code = generateCode(ex.build()).code;
            const { imp, out } = roundTrip(code);
            expect(imp.notes.filter((n) => n.severity === "warning")).toEqual([]);
            expect(out.problems).toEqual([]);
            expect(out.code).toBe(code);
        });
    }

    it("imports a typical hand-written sketch", () => {
        const sketch = `
// Blink with serial output
const int ledPin = 13;
int count = 0;

void setup() {
  pinMode(ledPin, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(ledPin, HIGH);
  delay(500);
  digitalWrite(ledPin, LOW);
  delay(500);
  count = count + 1;
  if (count > 10) {
    Serial.println("ten blinks");
  } else {
    Serial.println(count);
  }
}`;
        const { imp, out } = roundTrip(sketch);
        expect(imp.notes.filter((n) => n.severity === "warning")).toEqual([]);
        expect(out.problems).toEqual([]);
        expect(out.code).toContain("const int LEDPIN = 13;");
        expect(out.code).toContain("int count = 0;");
        expect(out.code).toContain(
            [
                "void setup() {",
                "    pinMode(LEDPIN, OUTPUT);",
                "    Serial.begin(9600);",
                "}",
            ].join("\n"),
        );
        expect(out.code).toContain(
            [
                "void loop() {",
                "    digitalWrite(LEDPIN, HIGH);",
                "    delay(500);",
                "    digitalWrite(LEDPIN, LOW);",
                "    delay(500);",
                "    count = count + 1;",
                "    if (count > 10) {",
                '        Serial.println("ten blinks");',
                "    } else {",
                "        Serial.println(count);",
                "    }",
                "}",
            ].join("\n"),
        );
        // the 500 literal is one block reused, with one usage per statement
        const params = imp.diagram.nodes.filter((n) => n.data.name === "Parameter(s)" && n.data.extras.value === "500");
        expect(params).toHaveLength(1);
    });

    it("keeps object names, constructor arguments and pin ports", () => {
        const sketch = `#include <Servo.h>
#include <Stepper.h>
Servo arm;
Stepper motor(200, 8, 9);
void setup() {
  arm.attach(9);
  motor.setSpeed(60);
}
void loop() {
  arm.write(90);
  motor.step(100);
}`;
        const { imp, out } = roundTrip(sketch);
        expect(imp.missingIncludes).toEqual([]);
        expect(out.problems).toEqual([]);
        expect(out.code).toContain("Servo arm;\nStepper motor(200, 8, 9);");
        expect(out.code).toContain("    arm.attach(9);\n    motor.setSpeed(60);");
        expect(imp.diagram.nodes.some((n) => n.data.name === "Port" && n.data.extras.value === "9")).toBe(true);
    });

    it("reports what it cannot express, with line numbers", () => {
        const sketch = `#include <Unknown.h>
int total = 0;
void blinkN(int n) { }
void setup() {
  for (int i = 0; i < 3; i++) {
    delay(10);
  }
  total++;
  int local = 3;
  analogWrite(9, map(total, 0, 10, 0, 255));
  frobnicate(1);
}
void loop() {}`;
        const { imp } = roundTrip(sketch);
        expect(imp.missingIncludes).toEqual(["Unknown.h"]);
        const warnings = imp.notes.filter((n) => n.severity === "warning").map((n) => [n.line, n.message.split(" ")[0]]);
        expect(warnings).toEqual([
            [3, "Function"],
            [5, "`for`"],
            [8, "`total++;`"],
            [9, "Unsupported"],
            [10, "Argument"],
            [11, "Unknown"],
        ]);
    });

    it("is deterministic", () => {
        const code = generateCode(examples[1].build()).code;
        expect(importSketch(code, builtInPalette)).toEqual(importSketch(code, builtInPalette));
    });
});
