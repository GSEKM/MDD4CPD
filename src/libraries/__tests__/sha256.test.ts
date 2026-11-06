import { describe, expect, it } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import { sha256Sync } from "../sha256";

describe("sha256 fallback (insecure contexts without crypto.subtle)", () => {
    it("matches known vectors", () => {
        expect(sha256Sync(new Uint8Array())).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
        expect(sha256Sync(new TextEncoder().encode("abc"))).toBe(
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
        );
    });
    it("matches node:crypto on block-boundary and large inputs", () => {
        for (const n of [55, 56, 63, 64, 65, 1000, 133580]) {
            const data = new Uint8Array(randomBytes(n));
            expect(sha256Sync(data)).toBe(createHash("sha256").update(data).digest("hex"));
        }
    });
});
