// const startDelta = 1000
// const endDelta = 2000
const controllerDelta = 3000
const methodDelta = 4000

export function getGoProperties(node: any) {
    let properties: any[] = []
    for (const [key, value] of Object.entries(node.extras)) {
        // if (!['selectableOptions'].includes(key))
        properties.push({ name: `${key}: ${value}`, visibility: 'private' })
    }
    return properties
}

export function getGoMethods(node: any) {
    let methods: any[] = []
    node.ports?.forEach((method: any) => {
        methods.push({ name: method.label, visibility: 'public' })
    });
    node.methods?.forEach((method: any) => {
        methods.push({ name: method, visibility: 'public' })
    });
    node.ins?.forEach((method: any) => {
        methods.push({ name: method, visibility: 'public' })
    });
    node.outs?.forEach((method: any) => {
        methods.push({ name: method, visibility: 'public' })
    });
    return methods
}
export function processDynamic(node: any, index: number, hasSupportNodes = true, badMethod: any = null) {
    let nodes: any[] = []
    let links: any[] = []

    nodes.push({ key: index + controllerDelta, name: 'MicroController' })
    nodes.push({
        key: index,
        name: node.name,
    })
    if (badMethod) {
        links.push({
            key: index + methodDelta,
            from: index + controllerDelta,
            to: index, text: badMethod.name,
            relationship: "state"
        })
    } else {
        getGoMethods(node).forEach((method, methodIndex) => {
            links.push({
                key: index + (methodIndex + 1) * methodDelta,
                from: index + controllerDelta,
                to: index, text: method.name,
                relationship: "state"
            })
        });
    }

    // if (hasSupportNodes) {
    //     nodes.push({ key: index + startDelta, category: "Start" })
    //     links.push({
    //         key: index + controllerDelta,
    //         from: index + startDelta,
    //         to: index + controllerDelta,
    //         relationship: "state"
    //     })
    //     nodes.push({ key: index + endDelta, category: "End" })
    //     links.push({
    //         key: index + endDelta,
    //         from: index,
    //         to: index + endDelta,
    //         relationship: "state"
    //     })
    // }

    return { nodes, links }
}