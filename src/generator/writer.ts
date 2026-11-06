// Small structured code writer: indentation follows the block structure
// instead of being reconstructed by counting braces afterwards.

export class CodeWriter {
    private lines: string[] = [];
    private level = 0;
    constructor(private readonly tab = "    ") {}

    line(text = "") {
        this.lines.push(text === "" ? "" : this.tab.repeat(this.level) + text);
    }

    /** One empty line; never two in a row, never at the start. */
    blank() {
        if (this.lines.length > 0 && this.lines[this.lines.length - 1] !== "") this.lines.push("");
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

    toString() {
        while (this.lines.length && this.lines[this.lines.length - 1] === "") this.lines.pop();
        return this.lines.join("\n") + "\n";
    }
}
