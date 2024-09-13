import {tokenize} from "./tokenize.js";

// parse函数接收模板作为参数
export function parse(str) {
    //首先对模板进行标记化，得到tokens
    const tokens = tokenize(str);

    //创建Root根节点
    const root = {
        type: 'Root',
        children: []
    }
    // 创建elementStack栈，起初只有Root根节点

    const elementStack = [root];

    while (tokens.length) {
        //获取当前栈顶节点作为父节点的parent
        const parent = elementStack[elementStack.length - 1];

        const t = tokens[0]
        switch (t.type) {
            case 'tag':
                const elementNode = {
                    type: 'Element',
                    tag: t.name,
                    children: []
                }
                //将其添加到父节点的children中
                parent.children.push(elementNode)
                // 讲当前节点压入到栈中
                elementStack.push(elementNode)
                break;
            case 'text':
                const textNode = {
                    type: 'Text',
                    content: t.content
                }
                // 将其添加到父节点的children中
                parent.children.push(textNode)
                break;
            case 'tagEnd':
                // 遇到结束标签，将栈顶节点弹出
                elementStack.pop()
                break;
        }

        //消费已经扫描过的token
        tokens.shift()
    }
    // 最后返回ast
    return root;
}

//遍历节点
export function traverseNode(ast, context) {
    // 当前节点
    // const currentNode = ast;
    // 设置当前转换的节点信息
    context.currentNode = ast;

    // 增加退出阶段回调函数数组
    const exitFns = [];

    //这里可以实现对节点的一些转换逻辑
    //nodeTransforms是一个数组，其中每个元素都是一个函数
    const transforms = context.nodeTransforms || []
    for (let i = 0; i < transforms.length; i++) {
        // 将当前节点currentNode和context都传递给nodeTransforms中注册的回调函数
        // 转换函数可以返回另外一个函数，该函数即作为退出阶段的回调函数
        const onExit = transforms[i](context.currentNode, context);

        // 如果有退出阶段的回调函数，则把函数添加到exitFns数组中
        if (onExit && typeof onExit === 'function') {
            exitFns.push(onExit);
        }

        //由于任何转换函数都可能移除当前节点、因此每个转换函数执行完毕后，都应该检查当前节点是否已经被移除，如果已经被移除，直接返回即可。
        if (!context.currentNode) return;
    }

    const children = context.currentNode.children;
    if (children) {
        for (let i = 0; i < children.length; i++) {
            // 递归调用traverseNode转换子节点之前，将当前节点设置为父节点
            context.parent = context.currentNode
            // 设置位置索引
            context.childIndex = i;
            // 递归调用时，将context透传
            traverseNode(children[i], context);
        }
    }
    // 执行退出函数(反序执行)
    let i = exitFns.length;
    while (i--) {
        exitFns[i]();
    }
}


// export function transform(ast) {
//     // 在transform函数内创建context对象
//     const context = {
//         // 增加currentNode,用来存储当前正在转换的节点
//         currentNode: null,
//         // 增加childIndex,用来存储当前节点在父节点的children中的位置索引
//         childIndex: 0,
//         // 增加parent, 用来存储当前转换节点的父节点
//         parent: null,
//         nodeTransforms: [
//             transformRoot,
//             transformElement,
//             transformText,
//         ],
//         // 用于替换节点的函数，接收新的节点作为参数
//         replaceNode(node) {
//             context.parent.children[context.childIndex] = node;
//             context.currentNode = node;
//         },
//         // 用于删除当前节点
//         removeNode(node) {
//             if (context.parent) {
//                 // 调用数组的splice方法，根据当前节点的索引删除当前节点
//                 context.parent.children.splice(context.childIndex, 1)
//                 context.currentNode = null;
//             }
//         }
//     }
//     // 调用traverseNode完成转换
//     traverseNode(ast, context);
// }


/**
 * 转换element节点
 * @param node
 */
// function transformElement(node) {
//     console.log('transformElement-进入阶段')
//     if (node.type === 'Element' && node.tag === 'p') {
//         node.tag = 'h1'
//     }
//     return () => {
//         console.log('transformElement-退出阶段')
//     }
// }
//
// /**
//  * 转换文本节点
//  * @param node
//  */
// function transformText(node, context) {
//     if (node.type === 'Text' && node.content) {
//         console.log('transformText进入阶段')
//         node.content = node.content.repeat(2)
//         // context.replaceNode({
//         //     type: 'Element',
//         //     tag: 'span'
//         // })
//     }
//     return () => {
//         console.log('transformText退出阶段')
//     }
// }



// 工具函数
export function dump(node, indent = 0) {
    const type = node.type;

    const desc = node.type === 'Root' ? '' : node.type === 'Element' ? node.tag : node.content;
    // 打印节点的类型和描述信息

    console.log(`${'-'.repeat(indent)}${type}:${desc}`)
    // 递归遍历子节点
    if (node.children) {
        node.children.forEach(child => {
            dump(child, indent + 2)
        })
    }
}
