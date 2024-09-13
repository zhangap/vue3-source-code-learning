// 把模板AST转换为javascript AST

//用来创建StringLiteral节点
import {parse, traverseNode} from "./parse.js";

function createStringLiteral(value) {
    return {
        type: 'StringLiteral',
        value,
    }
}

// 用来创建 Identifier 节点
function createIdentifier(name) {
    return {
        type: 'Identifier',
        name,
    }
}

// 用来创建ArrayExpression节点
function createArrayExpression(elements) {
    return {
        type: 'ArrayExpression',
        elements
    }
}

// 用来创建CallExpression
function createCallExpression(callee, args) {
    return {
        type: 'CallExpression',
        callee: createIdentifier(callee),
        arguments: args
    }
}


// 转换文本节点
export function transformText(node) {
    if (node.type !== 'Text') return
    node.jsNode = createStringLiteral(node.content)
}

export function transformElement(node) {
    return () => {
        if (node.type !== 'Element') return;

        // 1. 创建 h 函数调用语句,
        // h 函数调用的第一个参数是标签名称，因此我们以 node.tag 来创建一个字
        // 符串字面量节点
        const callExp = createCallExpression('h', [createStringLiteral(node.tag)]);

        // 处理h函数的调用参数
        node.children.length === 1 ? callExp.arguments.push(node.children[0]?.jsNode) : callExp.arguments.push(createArrayExpression(node.children.map(c => c.jsNode)))

        node.jsNode = callExp
    }
}


// 转换根节点
export function transformRoot(node) {
    return () => {
        if (node.type !== 'Root') {
            return
        }
        const vnodeJSAST = node.children[0].jsNode

        node.jsNode = {
            type: 'FunctionDecl',
            id: {type: 'Identifier', name: 'render'},
            params: [],
            body: [
                {
                    type: 'ReturnStatement',
                    return: vnodeJSAST
                }
            ]
        }
    }
}


export function compile(template) {
    // 模板ast
    const ast = parse(template);
    // 把模板ast转换为js ASt
    transform(ast)
    // 代码生成
    const code = generate(ast.jsNode)
    return code;
}

export function transform(ast) {
    // 在transform函数内创建context对象
    const context = {
        // 增加currentNode,用来存储当前正在转换的节点
        currentNode: null,
        // 增加childIndex,用来存储当前节点在父节点的children中的位置索引
        childIndex: 0,
        // 增加parent, 用来存储当前转换节点的父节点
        parent: null,
        nodeTransforms: [
            transformRoot,
            transformElement,
            transformText,
        ],
        // 用于替换节点的函数，接收新的节点作为参数
        replaceNode(node) {
            context.parent.children[context.childIndex] = node;
            context.currentNode = node;
        },
        // 用于删除当前节点
        removeNode(node) {
            if (context.parent) {
                // 调用数组的splice方法，根据当前节点的索引删除当前节点
                context.parent.children.splice(context.childIndex, 1)
                context.currentNode = null;
            }
        }
    }
    // 调用traverseNode完成转换
    traverseNode(ast, context);
}


// 生成代码
function generate(node) {
    const context = {
        code: '',
        push(code) {
            context.code += code;
        },
        // 当前缩进级别
        currentIndent: 0,
        newLine() {
            context.code += '\n' + ` `.repeat(context.currentIndent)
        },
        // 用来缩进,即让currentIndent自增后，调用换行函数
        indent() {
            context.currentIndent++;
            context.newLine();
        },
        // 取消缩进,即让currentIndent自减后，调用换行函数
        deIndent() {
            context.currentIndent--;
            context.newLine();
        }
    }
    // 调用genNode函数完成代码生成的工作
    genNode(node, context);
    return context.code;
}

function genNode(node, context) {
    switch (node.type) {
        case 'FunctionDecl':
            genFunctionDecl(node, context);
            break;
        case 'ReturnStatement':
            genReturnStatement(node, context);
            break;
        case 'CallExpression':
            genCallExpression(node, context);
            break;
        case 'StringLiteral':
            genStringLiteral(node, context);
            break;
        case 'ArrayExpression':
            genArrayExpression(node, context);
            break;
    }
}

function genFunctionDecl(node, context) {
    const {push, indent, deIndent} = context
    // node.js是一个标识符，用来描述函数的名称，即node.id.name
    push(`function ${node.id.name}`)
    push(`(`)
    // 调用 genNodeList为函数的参数生成代码
    genNodeList(node.params, context);
    push(`) `)
    push(`{`)
    // 缩进
    indent()
    node.body.forEach(n => {
        genNode(n, context)
    })
    //取消缩进
    deIndent()
    push(`}`)
}

function genReturnStatement(node, context) {
    const {push} = context;
    push(`return `);
    genNode(node.return, context);
}

function genCallExpression(node, context) {
    const {push} = context;
    const {callee, arguments: args} = node;
    push(`${callee.name}(`);
    genNodeList(args, context);
    push(`)`)
}

function genStringLiteral(node, context) {
    const {push} = context;
    push(`'${node.value}'`)
}

function genArrayExpression(node, context) {
    const {push} = context;
    push('[');
    genNodeList(node.elements, context);
    // 补全方括号
    push(']')

}

// 为函数的参数生成代码
function genNodeList(nodes, context) {
    const {push} = context;
    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        genNode(node, context)
        if (i < nodes.length - 1) {
            push(', ')
        }
    }
}

