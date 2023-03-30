export function querySelectorAll(selector:string, node:HTMLElement|Document = globalThis.document)  {
    const nodes = [...node.querySelectorAll(selector)],
        nodeIterator = document.createNodeIterator(node, Node.ELEMENT_NODE);
    let currentNode;
    while (currentNode = nodeIterator.nextNode()) {
        if(currentNode.shadowRoot) {
            nodes.push(...querySelectorAll(selector, currentNode.shadowRoot));
        }
    }
    return nodes;
}