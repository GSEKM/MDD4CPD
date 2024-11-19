/* eslint-disable jsx-a11y/anchor-is-valid */
import Prism from "prismjs";
import "./prism.css";
// import PrismEdit from "./PrismEdit";
import Xarrow from "react-xarrows";
import { onMount } from "svelte";
import getRepresentation from '../../Flow.svelte';
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { Tooltip as ReactTooltip } from "react-tooltip";

// import GoClass from "./GoClass"; // acredito que seja a representação do diagrama 

//import { processDynamic } from "./goBuilder"; // esse cara monta a representação 
import { getConnectedEdges } from '@xyflow/svelte';
import Flow, * as flow from "../../Flow.svelte";
import { get } from "http";
import { getOutgoers } from '@xyflow/svelte';
import { getIncomers } from '@xyflow/svelte';

const returnTypes = [
    "byte",
    "unsigned int",
    "unsigned long",
    "int",
    "long",
    "bool",
    "float",
    "double",
    "char",
];
const ordinals = [
    "first",
    "second",
    "third",
    "fourth",
    "fifth",
    "sixth",
    "seventh",
    "eighth",
    "ninth",
    "tenth",
    "eleventh",
];

const paramTypes = [
    "variable",
    "constant",
    "parameter",
    "port",
    "built-in-constant",
];

function generateCode(model: any): { code: string; problems: any[] } {
    console.log("model", model);
    // #region Reviewed Functions
    function addConstantDeclarations(constants: any) {
        if (constants.length > 0) {
            add("");
            add("// Constants");
            constants.forEach((constant: any) => {
                let params = constant.data.extras.value.split(",");
                const isArray = params.length > 1;
                const count = isArray ? "[" + params.length + "]" : "";
                params = isArray ? "{" + params.map((x: any) => x) + "}" : params;
                add(
                    `#define ${constant.data.extras.returnType} ${constant.data.extras.name}${count} = ${params};`
                );
            });
        }
    }
    function addVariableDeclarations(nodes: any) {
        if (nodes.length > 0) {
            add("");
            add("// Variables");

            const declaredVariables = new Set();
            const lifecycleMethods = controller?.data.handles.map((handle: any) => handle.edge) || [];

            nodes.forEach((node: any) => {
                const params = node.data.extras.variables?.split(",") || [];
                const declarationLocal = node.data.extras?.declarationLocal;
                const isArray = params.length > 1;
                const count = isArray ? `[${params.length}]` : "";
                const formattedParams = isArray ? `{${params.join(", ")}}` : params.join(", ");
                const equals = formattedParams ? "=" : "";

                // Verificar se o local de declaração corresponde a um método de ciclo de vida
                if (lifecycleMethods.includes(declarationLocal) && !declaredVariables.has(`${declarationLocal}:${formattedParams}`)) {
                    declaredVariables.add(`${declarationLocal}:${formattedParams}`);

                    // Adicionar a declaração de variáveis no método correspondente
                    add(`${formattedParams} ${count} ${equals} ${node.data.extras.parameters};`);
                }
            });
        }
    }


    function addFunctionDeclarations(functions: any) {
        if (functions.length > 0) {
            add("// Functions");
            functions.forEach((logic: any) => {
                if (getPort(logic.id, logic.portsInOrder[0]).edges.length === 0) {
                    declareFunction(logic);
                }
            });
        }
    }
    function declareFunction(logic: any) {
        add(`${logic.data.extras.returnType} ${logic.data.extras.value}(){`);
        const callPort = logic.ports.find((x: any) => x.alignment === "right");
        callPort.edges.forEach((l: any) => {
            processLink(l);
        });
        add("}");
    }

    function addLibraries() {
        const libraries: any[] = [
            ...new Set(components.map((component) => component.data.extras.library)),
        ];

        if (libraries.length > 0) {
            add("");
            add("// Libraries");
            libraries.forEach((lib: any) => {
                add("#include <" + lib + ">");
            });
            add("");
            add("// Objects");
            libraries.forEach((lib: any) => {
                components.forEach((comp) => {
                    if (comp.data.extras.library === lib) add(comp.name + " " + comp.instance);
                });
            });
        }
    }
    function formattedParameters(nodes: any) {
        return nodes.data.extra.variables.map((par: any) => {
            switch (par.data.extras.type) {
                case "parameter":
                case "port":
                    return par.data.extras.parameters;
                case "constant":
                case "variable":
                    return par.data.extras.variables;
                case "built-in-constant":
                    return par.name;
                default:
                    return "error on node type";
            }
        });
    }
    function indentCode(original: string) {
        let code: string[] = [];
        let level = 0;
        let tab = "    ";

        original.split("\n").forEach((line) => {
            const trimmedLine = line.trim();

            // Reduzir o nível de indentação se a linha for uma chave de fechamento
            if (trimmedLine === "}") {
                level--;
            }

            // Adicionar a linha com a indentação apropriada
            code.push(tab.repeat(Math.max(level, 0)) + trimmedLine);

            // Aumentar o nível de indentação se a linha for uma chave de abertura
            if (trimmedLine.endsWith("{")) {
                level++;
            }
        });

        return code.join("\n");
    }

    function warnAboutNodesWithoutEdges(nodes: any) {
        nodes.forEach((node: any) => {
            const outgoers = getOutgoers(node, nodes, edges);
            const incomers = getIncomers(node, nodes, edges);

            if (outgoers.length === 0 && incomers.length === 0) {
                warn("This component has no edges", node);
            }
        });
    }
    function warnAboutPortUsage() {
        usedDigital.forEach((port) => {
            if (port.data.extras.value >= controller?.data.extras.digitalPorts) {
                warn(
                    `This ${port.name} does not exist on this micro - controller`,
                    port
                );
            }
        });
        usedAnalog.forEach((port) => {
            if (port.data.extras.value >= controller?.data.extras.analogPorts) {
                warn(
                    `This ${port.name} does not exist on this micro - controller`,
                    port
                );
            }
        });
    }
    function warnAboutMultipleUsePorts(nodes: any) {
        nodes
            .filter((node: any) => paramTypes.includes(node.data.selectedType))
            .forEach((node: any) => {
                node.ports.forEach((port: any) => {
                    // console.log("checking ", port);
                    if (port.edges.length > 1) {
                        warn(
                            `This ${node.name.toLowerCase()} has more than one edge in the same ${port.label
                            } port.`,
                            node
                        );
                    } else {
                        if (port.name !== "in" && port.edges.length === 0) {
                            warn(`This ${node.name.toLowerCase()} is not being used.`, node);
                        }
                    }
                });
            });
    }
    function warnAboutLooseEdges(edges: any) {
        edges.forEach((edge: any) => {
            const fromPort = getPort(edge.source, edge.sourceHandle);
            const fromNode = getNode(fromPort?.source);
            const toPort = getPort(edge.target, edge.targetHandle);
            if (!toPort) {
                warn("Loose edge", fromNode);
            }
        });
    }
    function warnAboutExpectedVersusReceived(
        port: any,
        node: any,
        expected: any[],
        received: any[]
    ) {
        const expMin = expected.filter((e: any) => !e.includes("=")).length;
        const expMax = expected.length;

        if (received.length < expMin || received.length > expMax) {
            const count = expMin === expMax ? expMin : `${expMin} to ${expMax}`;
            warn(
                `The function call "${port.name}" is receiving ${received.length} parameters instead of the expected ${count}`,
                node,
                port
            );
            return "error";
        }
        return "ok";
    }

    function getEdgesFromModel(nodes: any) {
        const temp: any[] = [];
        Object.entries(nodes.edges).forEach((edge: any) => {
            temp.push(edge[1]);
        });
        console.log("edges", temp);
        return temp;
    }
    function getNodesFromModel(model: any) {
        const temp: any[] = [];
        Object.entries(model.nodes).forEach((node: any) => {
            temp.push(node[1]);
        });
        return temp;
    }
    function getComponentsFromNodes(nodes: any) {
        let temp: any[] = [];
        nodes
            .filter((node: any) => node.data.extras?.type === "custom")
            .forEach((node: any) => {
                node.instance =
                    node.name.toLowerCase().replace(" ", "") +
                    temp.filter((t) => t.data.extras?.library === node.data.extras?.library).length;
                temp.push(node);
            });
        return temp;
    }
    function warnAboutNumberOfControllers() {
        const controllers: any[] = nodes.filter(
            (node) => node.data.extras?.type === "controller"
        );
        if (controllers.length === 0) {
            warn("No micro-controller");
        }
        if (controllers.length > 1) {
            controllers.forEach((controller) => {
                warn("More than one micro-controller", controller);
            });
        }
    }
    function add(...message: string[]) {
        message.forEach((m) => {
            code += m;
        });
        code += "\n";
        return code;
    }
    function addHeaderComments() {
        add("/* Code generated for ", controller?.name);
        const uniqueDigitals = [...new Set(usedDigital.map((u) => u.data.extras.value))];
        const uniqueAnalogs = [...new Set(usedAnalog.map((u) => u.data.extras.value))];

        add(
            `Analog ports ${uniqueAnalogs.length} /${controller?.data.extras.analogPorts
            } ${usedAnalog.length > 0 ? `(${uniqueAnalogs.map((port) => port)})` : ""
            } `
        );
        add(
            `Digital ports ${uniqueDigitals.length}/${controller?.data.extras.digitalPorts
            } ${usedDigital.length > 0 ? `(${uniqueDigitals.map((port) => port)})` : ""
            }`,
            "    */"
        );
    }
    function getLink(edgeID: string) {

        return edges.find((l) => l.id === edgeID);
    }
    function getPort(nodeID: string, portID: string) {
        try {
            return nodes
                .find((n: any) => n.id === nodeID)
                .data.handles.find((p: any) => p.id === portID);
        } catch (error) {
            return null;
        }
    }
    /**
     * Only to be used for paramTypes !
     */
    function getOutPort(inPort: any) {
        try {
            const node = getNode(inPort.parentNode);
            const portPosition = node.portsInOrder.indexOf(inPort.id);
            const outPortId = node.portsOutOrder[portPosition];
            const outPort = node.ports.find((p: { id: any }) => p.id === outPortId);
            return outPort;
        } catch (error) {
            return null;
        }
    }

    function getNode(nodeID: string) {
        return nodes.find((n: any) => n.id === nodeID);
    }
    function getParent(childNode: any) {
        return nodes.find((n: any) => n.id === childNode.parentNode);
    }
    function warn(message: string, node: any = null, port: any = null) {
        problems.push({ message, node, port });
        return problems;
    }
    function addLifecycleMethods() {
        add("");
        add(`// Micro-controller's Lifecycle`);
        const declaredVariables = new Set<string>();
        const declaredMethods = new Set<string>();
        const processedEdges = new Set<string>();

        controller?.data.handles.forEach((handle: any) => {

            add(`void ${handle.edge} {`);

            // Filtrar os nós que correspondem ao método atual para declarar variáveis
            const matchingNodes = nodes.filter((node: any) => node.data.extras?.declarationLocal === handle.edge);

            // Declarar variáveis no método correspondente
            matchingNodes.forEach((node: any) => {
                const params = node.data.extras.variables?.split(",") || [];
                const isArray = params.length > 1;
                const count = isArray ? `[${params.length}]` : "";
                const formattedParams = isArray ? `{${params.join(", ")}}` : params.join(", ");
                const equals = formattedParams ? "=" : "";

                const variableKey = `${handle.edge}:${formattedParams}`;
                if (!declaredVariables.has(variableKey)) {
                    declaredVariables.add(variableKey);
                    add(`    ${formattedParams} ${count} ${equals} ${node.data.extras.parameters};`);
                }
            });

            // Filtrar as edges que correspondem ao handle atual e evitar duplicações
            const matchingEdges = edges.filter((edge: any) => edge.data?.methods?.includes(handle.edge));

            matchingEdges.forEach((edge: any) => {
                edge.data.methodsEnd?.forEach((methodDeclaration: string) => {
                    const methodKey = `${handle.edge}:${methodDeclaration}`;

                    // Verificar se o método já foi declarado
                    if (!declaredMethods.has(methodKey)) {
                        declaredMethods.add(methodKey);
                        add(`    ${methodDeclaration};`);
                    }
                });

                // Adicionar a edge ao Set de edges processadas
                processedEdges.add(edge.id);
            });

            add("}\n");
        });
    }


    // #endregion

    // #region Unreviewed Functions 
    function processLink(link: any) {
        const declaredMethods = new Set();

        // Função para declarar a chamada de método dinamicamente
        function declareMethodCall(sourceNode: any, targetNode: any, edge: any) {
            // Verificar se `edge.data` existe antes de acessar `methodsEnd`
            if (!edge.data || !edge.data.methodsEnd) {
                console.warn(`Dados do edge ou 'methodsEnd' não encontrados para o edge: ${edge.id}`);
                return;
            }

            const params = sourceNode.data.extras?.variables || "";
            const callLocation = sourceNode.data.extras?.declarationLocal;

            // Verificar se o local de chamada foi identificado
            if (!callLocation) {
                console.warn(`Local de chamada não encontrado para o link entre ${sourceNode.id} e ${targetNode.id}`);
                return;
            }

            // Iterar sobre cada entrada em `methodsEnd` e inseri-las no local correto
            edge.data.methodsEnd.forEach((methodDeclaration: string) => {
                // Evitar duplicação de declaração de métodos
                const methodKey = `${callLocation}:${methodDeclaration}`;
                if (!declaredMethods.has(methodKey)) {
                    declaredMethods.add(methodKey);
                    add(`    ${methodDeclaration};`);
                }
            });
        }

        // Iterar sobre cada edge dentro de `edges`
        edges.forEach((edge) => {
            const sourceNode = nodes.find((n) => n.id === edge.source);
            const targetNode = nodes.find((n) => n.id === edge.target);

            if (!sourceNode || !targetNode) {
                console.warn("Nó de origem ou destino não encontrado.");
                return;
            }

            console.log(`Processando edge com ID: ${edge.id}`);

            // Declarar a chamada de método usando todas as entradas de `methodsEnd`
            declareMethodCall(sourceNode, targetNode, edge);
        });
    }



    // function oldRemoveTypes(name: string): string {
    //     const firstSpace = name.indexOf(' ') + 1;
    //     const openningRound = name.indexOf('(');
    //     const closingRound = name.indexOf(')');

    //     const functionName = name.substring(firstSpace, openningRound);
    //     const params = name.substring(openningRound + 1, closingRound).split(',');
    //     let result = functionName;
    //     params.forEach(param => {
    //         if (!param.includes('=')) {
    //             let thisParam = String(param.split(' ').slice(-1));
    //             result += thisParam;
    //         }
    //     });
    //     console.log('removing types from "', name, '" params ', params, ' returning :', result);
    //     return result;
    // }

    // #endregion

    // #region Shared Variables
    let code = "";
    const problems: any[] = [];


    const nodes: any[] = getNodesFromModel(model);
    const edges: any[] = getEdgesFromModel(model);
    const logics: any[] = nodes.filter((node) => node.data.extras?.type === "logic");
    const components: any[] = getComponentsFromNodes(nodes);
    const controller = nodes.find((node) => node.data.extras?.type === "controller");
    const constants: any[] = nodes
        .filter((node) => node.data.extras?.type === "constant")
        .map((constant) => {
            constant.data.extras.name = constant.data.extras.name.toUpperCase();
            return constant;
        });
    const variables: any[] = nodes.filter(
        (node) => node.data.extras?.type === "variable"
    );

    console.log('varrrr', variables)

    const usedDigital: any[] = [
        ...new Set(nodes.filter((node) => node.data.extras?.portType === "Digital")),
    ];
    const usedAnalog: any[] = [
        ...new Set(nodes.filter((node) => node.data.extras?.portType === "Analog")),
    ];
    // #endregion

    // #region Generator Lifecycle
    console.log("----- Starting Code Generation -----");
    //to fo fix all warnings and header comments
    addHeaderComments();
    warnAboutNumberOfControllers();
    warnAboutPortUsage();
    warnAboutNodesWithoutEdges(nodes);
    warnAboutMultipleUsePorts(nodes);
    warnAboutLooseEdges(edges);
    addLibraries();
    addFunctionDeclarations(logics.filter((l) => l.name === "Function"));
    addConstantDeclarations(constants);
    addVariableDeclarations(nodes);
    addLifecycleMethods();
    // #endregion
    return { code: indentCode(code), problems };
}
export default function Code(props: { model: string }): { code: string; problems: any[] } {
    console.log('CodeComponent render', props.model);

    const model = props.model;
    let code = "";
    let problems: any[] = [];
    let uniqueProblems: any[] = [];

    if (model === "{}" || model === "") {
        return { code: "", problems: [] };
    } else {
        ({ code, problems } = generateCode(JSON.parse(model)));

        uniqueProblems = problems.filter((problem, index, self) => {
            return index === self.findIndex((p) => p.message === problem.message);
        });
    }

    console.log("code", code);

    // Retornar o resultado
    return { code, problems };
}