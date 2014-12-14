var applyProperties = require("./apply-properties")

var isWidget = require("vtree/is-widget")
var VPatch = require("vtree/vpatch")

var render = require("./create-element")
var updateWidget = require("./update-widget")

module.exports = applyPatch

function applyPatch(vpatch, domNode, renderOptions) {
    var type = vpatch.type
    var vNode = vpatch.vNode
    var patch = vpatch.patch

    switch (type) {
        case VPatch.REMOVE:
            return removeNode(domNode, vNode)
        case VPatch.INSERT:
            return insertNode(domNode, patch, renderOptions)
        case VPatch.VTEXT:
            return stringPatch(domNode, vNode, patch, renderOptions)
        case VPatch.WIDGET:
            return widgetPatch(domNode, vNode, patch, renderOptions)
        case VPatch.VNODE:
            return vNodePatch(domNode, vNode, patch, renderOptions)
        case VPatch.ORDER:
            reorderChildren(domNode, patch)
            return domNode
        case VPatch.PROPS:
            applyProperties(domNode, patch, vNode.properties)
            return domNode
        case VPatch.THUNK:
            return replaceRoot(domNode,
                renderOptions.patch(domNode, patch, renderOptions))
        default:
            return domNode
    }
}

function removeNode(domNode, vNode) {
    var parentNode = domNode.parentNode

    if (parentNode) {
        if (domNode.nodeType === 3) {
            var nodeIndex = [].slice.call(parentNode.childNodes, 0).indexOf(domNode);
            opLog($(domNode).cssSelector(), 'contents().get(' + nodeIndex + ').remove');
        }
        else {
            opLog($(domNode).cssSelector(), 'remove');
        }

        parentNode.removeChild(domNode)
    }

    destroyWidget(domNode, vNode);

    return null
}

function insertNode(parentNode, vNode, renderOptions) {
    var newNode = render(vNode, renderOptions)

    if (parentNode) {

        // If something is being inserted in BODY, means that siblings have
        // added to the edited node. In that case we can't use `append`
        // operation due to localized (not actual tree) DOM here. Instead use `after` op.
        if (parentNode.tagName.toLowerCase() === 'body') {
            if (parentNode.lastChild.nodeType === 3) {
                var nodeIndex = parentNode.childNodes.length - 1;
                opLog($(parentNode).cssSelector(), 'contents().eq(' + nodeIndex + ').after', newNode.nodeType === 3 ? newNode.textContent : newNode.outerHTML);
            }
            else {
                opLog($(parentNode.lastChild).cssSelector(), 'after', newNode.nodeType === 3 ? newNode.textContent : newNode.outerHTML);
            }
        }
        else {
            opLog($(parentNode).cssSelector(), 'append', newNode.nodeType === 3 ? newNode.textContent : newNode.outerHTML);
        }

        parentNode.appendChild(newNode)
    }

    return parentNode
}

function stringPatch(domNode, leftVNode, vText, renderOptions) {
    var newNode

    if (domNode.nodeType === 3) {
        var nodeIndex = [].slice.call(domNode.parentNode.childNodes, 0).indexOf(domNode);
        opLog($(domNode).cssSelector(), 'contents().eq(' + nodeIndex + ').replaceWith', vText.text);

        domNode.replaceData(0, domNode.length, vText.text)
        newNode = domNode
    } else {
        var parentNode = domNode.parentNode
        newNode = render(vText, renderOptions)

        if (parentNode) {
            opLog($(domNode).cssSelector(), 'replaceWith', newNode.outerHTML || newNode.textContent);

            parentNode.replaceChild(newNode, domNode)
        }
    }

    destroyWidget(domNode, leftVNode)

    return newNode
}

function widgetPatch(domNode, leftVNode, widget, renderOptions) {
    if (updateWidget(leftVNode, widget)) {
        return widget.update(leftVNode, domNode) || domNode
    }

    var parentNode = domNode.parentNode
    var newWidget = render(widget, renderOptions)

    if (parentNode) {
        parentNode.replaceChild(newWidget, domNode)
    }

    destroyWidget(domNode, leftVNode)

    return newWidget
}

function vNodePatch(domNode, leftVNode, vNode, renderOptions) {
    var parentNode = domNode.parentNode
    var newNode = render(vNode, renderOptions)

    if (parentNode) {
        if (domNode.nodeType === 3) {
            var nodeIndex = [].slice.call(parentNode.childNodes).indexOf(domNode);
            opLog($(domNode).cssSelector(),  'contents().eq(' + nodeIndex +  ')' + '.replaceWith', newNode.outerHTML);
        }
        else {
            opLog($(domNode).cssSelector(),  'replaceWith', newNode.outerHTML);
        }

        parentNode.replaceChild(newNode, domNode)
    }

    destroyWidget(domNode, leftVNode)

    return newNode
}

function destroyWidget(domNode, w) {
    if (typeof w.destroy === "function" && isWidget(w)) {
        w.destroy(domNode)
    }
}

function reorderChildren(domNode, bIndex) {
    var children = []
    var childNodes = domNode.childNodes
    var len = childNodes.length
    var i
    var reverseIndex = bIndex.reverse

    for (i = 0; i < len; i++) {
        children.push(domNode.childNodes[i])
    }

    var insertOffset = 0
    var move
    var node
    var insertNode
    for (i = 0; i < len; i++) {
        move = bIndex[i]
        if (move !== undefined && move !== i) {
            // the element currently at this index will be moved later so increase the insert offset
            if (reverseIndex[i] > i) {
                insertOffset++
            }

            node = children[move]
            insertNode = childNodes[i + insertOffset] || null
            if (node !== insertNode) {
                domNode.insertBefore(node, insertNode)
            }

            // the moved element came from the front of the array so reduce the insert offset
            if (move < i) {
                insertOffset--
            }
        }

        // element at this index is scheduled to be removed so increase insert offset
        if (i in bIndex.removes) {
            insertOffset++
        }
    }
}

function replaceRoot(oldRoot, newRoot) {
    if (oldRoot && newRoot && oldRoot !== newRoot && oldRoot.parentNode) {
        console.log(oldRoot)
        oldRoot.parentNode.replaceChild(newRoot, oldRoot)
    }

    return newRoot;
}
