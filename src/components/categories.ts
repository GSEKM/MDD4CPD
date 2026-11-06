// Palette/node categories, keyed by a node's extras.type.
// Colours come from the --cat-* tokens in app.css.

export type Category = {
    key: string;
    label: string;
    color: string;
    hint: string;
};

const categories: Record<string, Category> = {
    controller: {
        key: "controller",
        label: "Micro-controllers",
        color: "var(--cat-controller)",
        hint: "Start here: setup() and loop() are the program entry points",
    },
    port: {
        key: "port",
        label: "Values",
        color: "var(--cat-value)",
        hint: "Pins, literals, variables and constants passed as arguments",
    },
    parameter: { key: "port", label: "Values", color: "var(--cat-value)", hint: "" },
    variable: { key: "port", label: "Values", color: "var(--cat-value)", hint: "" },
    constant: { key: "port", label: "Values", color: "var(--cat-value)", hint: "" },
    "built-in-constant": {
        key: "built-in-constant",
        label: "Arduino constants",
        color: "var(--cat-constant)",
        hint: "HIGH, LOW, OUTPUT, ...",
    },
    logic: {
        key: "logic",
        label: "Logic",
        color: "var(--cat-logic)",
        hint: "Functions, conditions and loops",
    },
    "built-in": {
        key: "built-in",
        label: "Arduino functions",
        color: "var(--cat-built-in)",
        hint: "Core library: digital/analog I/O, time, math, serial ...",
    },
    component: {
        key: "component",
        label: "Components",
        color: "var(--cat-component)",
        hint: "Library classes; each node becomes an object instance",
    },
};

export const categoryOrder = [
    "controller",
    "port",
    "logic",
    "built-in",
    "built-in-constant",
    "component",
];

export function categoryOf(type: string | undefined): Category {
    return (
        categories[type ?? ""] ?? {
            key: type ?? "other",
            label: type ?? "Other",
            color: "var(--text-3)",
            hint: "",
        }
    );
}

/** Plain text from palette descriptions (some contain HTML). */
export function plainText(html: string | undefined): string {
    if (!html) return "";
    return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}
