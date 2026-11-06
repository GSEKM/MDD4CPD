// Problems found in the model while generating code.

export type Severity = "error" | "warning";

export type ProblemCode =
    | "no-controller"
    | "multiple-controllers"
    | "port-out-of-range"
    | "unlinked-block"
    | "multiple-links"
    | "unused-value"
    | "loose-link"
    | "arity"
    | "type"
    | "constructor"
    | "unsupported"
    | "cycle";

export type Problem = {
    code: ProblemCode;
    severity: Severity;
    message: string;
    nodeId?: string;
    nodeName?: string;
    handleId?: string;
};

const severities: Record<ProblemCode, Severity> = {
    "no-controller": "error",
    "multiple-controllers": "error",
    "port-out-of-range": "error",
    "unlinked-block": "warning",
    "multiple-links": "warning",
    "unused-value": "warning",
    "loose-link": "error",
    arity: "error",
    type: "warning",
    constructor: "error",
    unsupported: "error",
    cycle: "error",
};

export class Problems {
    readonly list: Problem[] = [];

    add(code: ProblemCode, message: string, node?: { id: string; data?: any }, handleId?: string) {
        this.list.push({
            code,
            severity: severities[code],
            message,
            nodeId: node?.id,
            nodeName: node?.data?.name,
            handleId,
        });
    }
}
