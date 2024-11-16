import * as go from 'gojs';
import { ReactDiagram } from 'gojs-react';

import './go.css';
function initDiagram(options: any) {
    // console.log('initDiagram with', options)
    const $ = go.GraphObject.make;
    // go.TreeLayout.ArrangementVertical :


    const myDiagram = $(go.Diagram,
        {
            layout: $(go.TreeLayout,
                { // this only lays out in trees nodes connected by "generalization" links
                    angle: options?.isTree ? 90 : 180,
                    path: go.TreeLayout.PathSource,  // links go from child to parent
                    setsPortSpot: false,  // keep Spot.AllSides for link connection spot
                    setsChildPortSpot: false,  // keep Spot.AllSides
                    arrangement: options?.isTree ? go.TreeLayout.ArrangementHorizontal : undefined,
                    nodeSpacing: 1000, layerSpacing: 1000
                })
        });

    function convertVisibility(v: any) {
        switch (v) {
            case "public": return "+";
            case "private": return "-";
            case "protected": return "#";
            case "package": return "~";
            default: return v;
        }
    }

    var propertyTemplate =
        $(go.Panel, "Horizontal",
            // property visibility/access
            $(go.TextBlock,
                { isMultiline: false, editable: false, width: 12 },
                new go.Binding("text", "visibility", convertVisibility)),
            // property name, underlined if scope=="class" to indicate static property
            $(go.TextBlock,
                { isMultiline: false, editable: true },
                new go.Binding("text", "name").makeTwoWay(),
                new go.Binding("isUnderline", "scope", s => s[0] === 'c')),
            // property type, if known
            $(go.TextBlock, "",
                new go.Binding("text", "type", t => t ? ": " : "")),
            $(go.TextBlock,
                { isMultiline: false, editable: true },
                new go.Binding("text", "type").makeTwoWay()),
            // property default value, if any
            $(go.TextBlock,
                { isMultiline: false, editable: false },
                new go.Binding("text", "default", s => s ? " = " + s : ""))
        );
    var methodTemplate =
        $(go.Panel, "Horizontal",
            // method visibility/access
            $(go.TextBlock,
                { isMultiline: false, editable: false, width: 12 },
                new go.Binding("text", "visibility", convertVisibility)),
            // method name, underlined if scope=="class" to indicate static method
            $(go.TextBlock,
                { isMultiline: false, editable: true },
                new go.Binding("text", "name").makeTwoWay(),
                new go.Binding("isUnderline", "scope", s => s[0] === 'c')),

            $(go.TextBlock, "",
                new go.Binding("text", "type", t => t ? ": " : "")),
            $(go.TextBlock,
                { isMultiline: false, editable: true },
                new go.Binding("text", "type").makeTwoWay())
        );

    myDiagram.nodeTemplate =
        $(go.Node, "Auto",
            {
                locationSpot: go.Spot.Center,
                fromSpot: go.Spot.AllSides,
                toSpot: go.Spot.AllSides
            },
            $(go.Shape, {
                fill: "lightcyan",
                minSize: !!options?.hasMinSize ? new go.Size(100, 200) : new go.Size(10, 10),
            }),
            $(go.Panel, "Table",
                { defaultRowSeparatorStroke: "black" },
                // header
                $(go.TextBlock,
                    {
                        row: 0, columnSpan: 2, margin: 3, alignment: go.Spot.Center,
                        font: "bold 12pt sans-serif",
                        isMultiline: false, editable: true
                    },
                    new go.Binding("text", "name").makeTwoWay()),
                // properties
                $(go.TextBlock, "Properties",
                    { row: 1, font: "italic 10pt sans-serif" },
                    new go.Binding("visible", "visible", v => !v).ofObject("PROPERTIES")),
                $(go.Panel, "Vertical", { name: "PROPERTIES" },
                    new go.Binding("itemArray", "properties"),
                    {
                        row: 1, margin: 3, stretch: go.GraphObject.Fill,
                        defaultAlignment: go.Spot.Left, background: "lightcyan",
                        itemTemplate: propertyTemplate
                    }
                ),
                $("PanelExpanderButton", "PROPERTIES",
                    { row: 1, column: 1, alignment: go.Spot.TopRight, visible: false },
                    new go.Binding("visible", "properties", arr => arr.length > 0)),


                $(go.TextBlock, "Methods",
                    { row: 2, font: "italic 10pt sans-serif" },
                    new go.Binding("visible", "visible", v => !v).ofObject("METHODS")),
                $(go.Panel, "Vertical", { name: "METHODS" },
                    new go.Binding("itemArray", "methods"),
                    {
                        row: 2, margin: 3, stretch: go.GraphObject.Fill,
                        defaultAlignment: go.Spot.Left, background: "lightcyan",
                        itemTemplate: methodTemplate
                    }
                ),
                $("PanelExpanderButton", "METHODS",
                    { row: 2, column: 1, alignment: go.Spot.TopRight, visible: false },
                    new go.Binding("visible", "methods", arr => arr.length > 0))
            )
        );
    myDiagram.nodeTemplateMap.add("Start",
        $(go.Node, "Spot", {
            locationSpot: go.Spot.Center,
            fromSpot: go.Spot.AllSides,
            toSpot: go.Spot.AllSides,
            desiredSize: new go.Size(75, 75)
        },
            new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
            $(go.Shape, "Circle",
                {
                    fill: "#52ce60", /* green */
                    stroke: null,
                }),
            $(go.TextBlock, "Start",
                {
                    font: "bold 16pt helvetica, bold arial, sans-serif",
                    stroke: "whitesmoke"
                })
        )
    );

    myDiagram.nodeTemplateMap.add("End",
        $(go.Node, "Spot", { desiredSize: new go.Size(75, 75) },
            new go.Binding("location", "loc", go.Point.parse).makeTwoWay(go.Point.stringify),
            $(go.Shape, "Circle",
                {
                    fill: "maroon",
                    stroke: null,
                }),
            $(go.Shape, "Circle", { fill: null, desiredSize: new go.Size(65, 65), strokeWidth: 2, stroke: "whitesmoke" }),
            $(go.TextBlock, "End",
                {
                    font: "bold 16pt helvetica, bold arial, sans-serif",
                    stroke: "whitesmoke"
                })
        )
    );
    function convertIsTreeLink(r: string) {
        return r === "generalization";
    }
    function convertIsStateLink(r: string) {
        return r === "state";
    }

    function convertFromArrow(r: any) {
        switch (r) {
            case "generalization": return "";
            default: return "";
        }
    }

    function convertToArrow(r: any) {
        switch (r) {
            case "generalization": return "Triangle";
            case "state": return "Triangle";
            case "aggregation": return "StretchedDiamond";
            default: return "";
        }
    }

    myDiagram.linkTemplate =
        $(go.Link,
            { routing: go.Link.Orthogonal },
            new go.Binding("isLayoutPositioned", "relationship", convertIsTreeLink),
            new go.Binding("isLayoutPositioned", "relationship", convertIsStateLink),
            $(go.Shape),
            $(go.Shape, { scale: 1.3, fill: "white" },
                new go.Binding("fromArrow", "relationship", convertFromArrow)),
            $(go.Shape, { scale: 1.3, fill: "white" },
                new go.Binding("toArrow", "relationship", convertToArrow)),
            $(go.TextBlock, "",
                {
                    textAlign: "center",
                    font: "12pt helvetica, arial, sans-serif",
                    margin: 4,
                    editable: false
                },
                new go.Binding("text").makeTwoWay()),
        );

    myDiagram.model = new go.GraphLinksModel(
        {
            linkKeyProperty: 'key',
            copiesArrays: true,
            copiesArrayObjects: true,
        });

    return myDiagram;
}

export default function GoClass(props: { nodedata: any, linkdata: any, diagramOptions?: any }) {
    return (
        <ReactDiagram
            initDiagram={() => initDiagram(props.diagramOptions)}
            divClassName='diagram-component'
            nodeDataArray={props.nodedata}
            linkDataArray={props.linkdata}
        />
    );
}