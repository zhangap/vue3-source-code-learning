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
function traverseNode(ast, context) {
    // 当前节点
    const currentNode = ast;

    //这里可以实现对节点的一些转换逻辑
    //nodeTransforms是一个数组，其中每个元素都是一个函数
    const transforms = context.nodeTransforms || []
    for (let i = 0; i < transforms.length; i++) {
        // 将当前节点currentNode和context都传递给nodeTransforms中注册的回调函数
        transforms[i](currentNode, context);
    }

    const children = currentNode.children;
    if (children) {
        for (let i = 0; i < children.length; i++) {
            traverseNode(children[i], context);
        }
    }
}


export function transform(ast) {
    // 在transform函数内创建context对象
    const context = {
        nodeTransforms: [
            transformElement,
            transformText,
        ]
    }
    // 调用traverseNode完成转换
    traverseNode(ast, context);
    console.log(dump(ast));
}

function transformElement(node) {
    if (node.type === 'Element' && node.tag === 'p') {
        node.tag = 'h1'
    }
}

function transformText(node) {
    if (node.type === 'Text' && node.content) {
        node.content = node.content.repeat(2)
    }
}

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
