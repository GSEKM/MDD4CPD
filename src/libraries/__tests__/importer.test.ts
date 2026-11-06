import { describe, expect, it } from "vitest";
import { strToU8, unzipSync, zipSync } from "fflate";
import { compareVersions, findLibraryForHeader, importLibrary, latestVersions, libraryFiles, searchIndex } from "../importer";
import { generateCode } from "../../generator/generate";
import { link, makeNode } from "../../components/examples";
import { createHandles } from "../../components/nodes/handles";
import { createHash } from "node:crypto";

const header = `class Blinker : public Print {
public:
  Blinker(uint8_t pin);
  void begin();
  void blink(int times, unsigned long ms = 200);
};`;

function zip() {
    return zipSync({
        "Blinker-1.2.0/library.properties": strToU8("name=Blinker\nversion=1.2.0\nincludes=Blinker.h\n"),
        "Blinker-1.2.0/src/Blinker.h": strToU8(header),
        "Blinker-1.2.0/src/utility/internal.h": strToU8("class Internal { public: void x(); };"),
        "Blinker-1.2.0/examples/Demo/Demo.ino": strToU8("void setup(){}"),
    });
}

const entry = (data: Uint8Array, checksum?: string) => ({
    name: "Blinker",
    version: "1.2.0",
    author: "",
    sentence: "Blinks things",
    category: "Display",
    website: "https://example.org",
    url: "https://example.org/Blinker-1.2.0.zip",
    checksum: checksum ?? "SHA-256:" + createHash("sha256").update(data).digest("hex"),
    size: data.length,
    architectures: ["*"],
});

const fakeFetch = (data: Uint8Array) => (async () => new Response(data)) as unknown as typeof fetch;

describe("library index", () => {
    it("orders versions numerically and keeps the latest", () => {
        expect(compareVersions("1.10.0", "1.9.2")).toBeGreaterThan(0);
        const libs = latestVersions([
            { name: "B", version: "1.9.2", url: "" },
            { name: "B", version: "1.10.0", url: "" },
            { name: "A", version: "0.1", url: "" },
        ]);
        expect(libs.map((l) => `${l.name}@${l.version}`)).toEqual(["A@0.1", "B@1.10.0"]);
    });

    it("ranks search results deterministically", () => {
        const libs = latestVersions(
            ["Servo", "ServoEasing", "Adafruit PWM Servo Driver Library", "Motor"].map((name) => ({
                name,
                version: "1.0",
                url: "",
                sentence: name === "Motor" ? "drives a servo" : "",
            })),
        );
        expect(searchIndex(libs, "servo").map((l) => l.name)).toEqual([
            "Servo",
            "ServoEasing",
            "Adafruit PWM Servo Driver Library",
            "Motor",
        ]);
    });
});

describe("header resolution", () => {
    const index = latestVersions([
        { name: "Servo", version: "1.3.0", url: "", providesIncludes: ["Servo.h"] },
        { name: "MultiLcd", version: "1.0", url: "", providesIncludes: ["multilcd.h", "LiquidCrystal.h"] },
        { name: "LiquidCrystal", version: "1.0.7", url: "" },
        { name: "ServoESP32", version: "1.0", url: "", providesIncludes: ["Servo.h"] },
        { name: "DHT sensor library", version: "1.4.7", url: "" },
        { name: "Adafruit BMP085 Library", version: "1.2.4", url: "" },
    ]);
    it("prefers providesIncludes, then the exact and shortest name", () => {
        expect(findLibraryForHeader(index, "Servo.h")!.name).toBe("Servo");
    });
    it("falls back to a library named like the header", () => {
        expect(findLibraryForHeader(index, "Adafruit_BMP085.h")!.name).toBe("Adafruit BMP085 Library");
        expect(findLibraryForHeader(index, "DHT.h")).toBeNull();
        // a library named like the header beats one that merely lists it
        expect(findLibraryForHeader(index, "LiquidCrystal.h")!.name).toBe("LiquidCrystal");
    });
});

describe("library import", () => {
    it("finds headers in src/ and reads library.properties", () => {
        const files = libraryFiles(unzipSync(zip()));
        expect(files.properties.includes).toBe("Blinker.h");
        expect(files.headers.map((h) => h.path)).toEqual(["Blinker.h", "utility/internal.h"]);
    });

    it("verifies the checksum and builds palette blocks", async () => {
        const data = zip();
        const lib = await importLibrary(entry(data), fakeFetch(data));
        expect(lib.components.map((c) => c.name)).toEqual(["Blinker"]);
        const [blinker] = lib.components;
        expect(blinker.extras).toMatchObject({
            type: "component",
            library: "Blinker.h",
            className: "Blinker",
            packageName: "Blinker",
            version: "1.2.0",
        });
        expect(blinker.methods.slice(0, 3)).toEqual([
            "Blinker(uint8_t pin)",
            "void begin()",
            "void blink(int times, unsigned long ms = 200)",
        ]);
    });

    it("rejects an archive that does not match the index", async () => {
        const data = zip();
        await expect(importLibrary(entry(data, "SHA-256:" + "0".repeat(64)), fakeFetch(data))).rejects.toThrow(
            /Checksum/,
        );
    });

    it("imported blocks generate code like built-in ones", async () => {
        const data = zip();
        const [def] = (await importLibrary(entry(data), fakeFetch(data))).components;
        const blinker = { id: "b", type: "custom", position: { x: 0, y: 0 }, data: { ...def, handles: createHandles(def) } };
        const uno = makeNode("Arduino Uno", 0, 0);
        const pin = makeNode("Port", 0, 0, { value: "13" });
        const edges: any[] = [];
        link(edges, uno, "setup()", pin, "in");
        link(edges, pin, "out", blinker as any, "Blinker(uint8_t pin)");
        link(edges, uno, "setup()", blinker as any, "void begin()");
        const { code, problems } = generateCode({ nodes: [uno, pin, blinker as any], edges });
        expect(problems).toEqual([]);
        expect(code).toContain("#include <Blinker.h> // Blinker 1.2.0");
        expect(code).toContain("Blinker blinker0(13);");
        expect(code).toContain("    blinker0.begin();");
    });
});
