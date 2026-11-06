// Small structured code writer: indentation follows the block structure
// instead of being reconstructed by counting braces afterwards. Each line can
// carry a tag (the id of the statement that produced it), which is how the
// editor maps code lines back to diagram links.

export type Entry = { text: string; tag: number | null };

export class CodeWriter {
    private lines: Entry[] = [];
    private level = 0;
    private tagStack: number[] = [];
    constructor(private readonly tab = "    ") {}

    private get tag(): number | null {
        return this.tagStack.length ? this.tagStack[this.tagStack.length - 1] : null;
    }

    line(text = "") {
        this.lines.push({ text: text === "" ? "" : this.tab.repeat(this.level) + text, tag: this.tag });
    }

    /** One empty line; never two in a row, never at the start. */
    blank() {
        const last = this.lines[this.lines.length - 1];
        if (last && last.text !== "") this.lines.push({ text: "", tag: null });
    }

    comment(text: string) {
        this.line(`// ${text}`);
    }

    /** `header {` ... `}` with the body indented. */
    block(header: string, body: () => void, footer = "}") {
        this.line(`${header} {`);
        this.level++;
        body();
        this.level--;
        this.line(footer);
    }

    /** Continues an open block: `} else {`. */
    dedentLine(text: string) {
        this.level--;
        this.line(text);
        this.level++;
    }

    /** Lines written inside `fn` are tagged with `tag` (innermost tag wins). */
    withTag(tag: number, fn: () => void) {
        this.tagStack.push(tag);
        try {
            fn();
        } finally {
            this.tagStack.pop();
        }
    }

    /** Appends lines of another writer at the current indentation. */
    append(entries: Entry[]) {
        entries.forEach((e) =>
            this.lines.push({ text: e.text === "" ? "" : this.tab.repeat(this.level) + e.text, tag: e.tag }),
        );
    }

    /** Lines without trailing blanks. */
    entries(): Entry[] {
        const out = [...this.lines];
        while (out.length && out[out.length - 1].text === "") out.pop();
        return out;
    }

    toString() {
        return this.entries().map((e) => e.text).join("\n") + "\n";
    }
}
