//定义文本模式，作为一个状态表
const TextModes = {
    DATA: 'DATA',
    RCDATA: 'RCDATA',
    RAWTEXT: 'RAWTEXT',
    CDATA: 'CDATA'
}


/**
 * 解析器函数，接收模板作为参数
 * @param str
 */
export function parse(str) {
    // 定义上下文
    const context = {
        source: str,
        // 解析当前处于文本模式
        mode: TextModes.DATA,
        //advanceBy函数用来消费指定数量的字符，它接收一个数字作为参数
        advanceBy(num) {
            context.source = context.source.slice(num)
        },
        advanceSpaces() {
            // 匹配空白字符
            const match = /^[\t\r\n\f ]+/.exec(context.source)
            if (match) {
                // 调用advanceBy消费空白字符
                context.advanceBy(match[0].length);
            }
        }
    };

    // 调用parseChildren函数开始进行解析，并返回解析后得到的子节点
    const nodes = parseChildren(context, []);

    return {
        type: 'Root',
        children: nodes,
    }
}

function parseChildren(context, ancestors) {
    // 定义数组存储子节点，将他作为最终的返回值
    let nodes = [];

    // 开启while循环，只要满足条件就会一直对字符串进行解析
    while (!isEnd(context, ancestors)) {
        const {mode, source} = context;
        let node
        if (mode === TextModes.DATA || mode === TextModes.RCDATA) {
            // 只有DATA模式才支持标签节点的解析
            if (mode === TextModes.DATA && source[0] === '<') {
                if (source[1] === '!') {
                    // 注释节点
                    if (source.startsWith('<!--')) {
                        node = parseComment(context)
                    } else if (source.startsWith('<![CDATA[')) {
                        //CDATA
                        node = parseCDATA(context)
                    }
                } else if (source[1] === '/') {
                    //结束标签，这里需要抛出错误
                } else if (/[a-z]/i.test(source[1])) {
                    //标签
                    node = parseElement(context, ancestors)
                }
            } else if (source.startsWith('{{')) {
                // 解析插值
                node = parseInterpolation(context)
            }
        }
        // node不存在，说明处于其他模式，即非DATA模式且RCDATA模式，
        if (!node) {
            node = parseText(context)
        }
        // 将节点添加到nodes数组中
        nodes.push(node);
    }
    return nodes;
}

// 解析注释节点
function parseComment(context) {
    context.advanceBy('<!--'.length);
    // 找到注释结束部分的位置索引
    const closeIndex = context.source.indexOf('-->');
    //截取注释节点的内容
    const content = context.source.slice(0,closeIndex);
    // 消费内容
    context.advanceBy(content.length);
    // 消费注释结束部分
    context.advanceBy('-->'.length);

    // 返回类型为Comment的节点
    return {
        type: 'Comment',
        content,
    }
}

function parseCDATA() {

}

// 解析标签
function parseElement(context, ancestors) {
    const element = parseTag(context)
    if (element.isSelfClosing) return element;

    // 切换到正确的文本模式
    if (element.tag === 'textarea' || element.tag === 'title') {
        context.mode = TextModes.RCDATA
    } else if (/style|xmp|iframe|noembed|noframes|noscript/.test(element.tag)) {
        context.mode = TextModes.RAWTEXT
    } else {
        context.mode = TextModes.DATA
    }

    ancestors.push(element);
    element.children = parseChildren(context, ancestors)
    ancestors.pop();

    if (context.source.startsWith(`</${element.tag}>`)) {
        parseTag(context, 'end')
    } else {
        console.error(`${element.tag}标签吴少闭合标签`)
    }
    return element;
}

// 解析插值
function parseInterpolation(context) {
    //消费开始界定符
    context.advanceBy('{{'.length);
    // 找到结束界定符的位置索引
    const closeIndex = context.source.indexOf('}}');
    if (closeIndex < 0) {
        console.error('插值缺少结束定界符');
    }
    // 截取开始定界符与结束定界符之间的内容作为插值表达式
    const content = context.source.slice(0, closeIndex);
    //消费表达式内容
    context.advanceBy(content.length);
    //消费结束定界符
    context.advanceBy('}}'.length);

    return {
        type: 'Interpolation',
        content: {
            type: 'Expression',
            content: decodeHtml(content)
        }
    }

}

//解析文本节点
function parseText(context) {
    // 文本内容的结尾索引
    let endIndex = context.source.length;

    //寻找字符<的位置索引
    const ltIndex = context.source.indexOf('<');
    // 寻找定界符
    const delimiterIndex = context.source.indexOf('{{');

    if (ltIndex > -1 && ltIndex < endIndex) {
        endIndex = ltIndex;
    }
    if (delimiterIndex > -1 && delimiterIndex < endIndex) {
        endIndex = delimiterIndex;
    }
    const content = context.source.slice(0, endIndex);
    //消费文本内容
    context.advanceBy(content.length);
    return {
        type: 'Text',
        content: decodeHtml(content) //调用decodeHtml函数解码内容
    }

}

// 解析标签
function parseTag(context, type = 'start') {
    const {advanceBy, advanceSpaces} = context;
    //处理开始标签和结束标签的正则表达式不同
    const match = type === 'start' ? /^<([a-z][^\t\r\n\f />]*)/i.exec(context.source) : /^<\/([a-z][^\t\r\n\f />]*)/i.exec(context.source);

    const tag = match[1]
    advanceBy(match[0].length);
    // 消费标签中无用的空白字符
    advanceSpaces()

    // 调用 parseAttributes 函数完成属性与指令的解析，并得到 props 数组，
    const props = parseAttributes(context)
    // 在消费匹配的内容后，如果字符串以'</>'开头，则说明这是一个自闭合标签
    const isSelfClosing = context.source.startsWith(`/>`);
    // 如果是自闭合标签，则消费'/>'，否则消费'>'
    advanceBy(isSelfClosing ? 2 : 1);

    //返回标签节点
    return {
        type: 'Element',
        tag,
        props,
        children: [],
        isSelfClosing,
    }
}

//解析属性
function parseAttributes(context) {
    const {advanceBy, advanceSpaces} = context;
    const props = [];

    while (!context.source.startsWith(`<`) && !context.source.startsWith('/>')) {
        const match = /^[^\t\r\n\f />][^\t\r\n\f/>=]*/.exec(context.source);
        if(!match) break;
        // 得到属性名
        const name = match[0];
        // 消费属性名
        advanceBy(name.length);
        // 消费属性名称与等于号之间的空白字符
        advanceSpaces();
        // 消费等于号
        advanceBy(1);
        // 消费等于号与属性值之间的空白字符
        advanceSpaces();

        let value = '';
        // 获取当前模板内容的第一个字符
        const quote = context.source[0]
        // 判断属性值是否被引号引用
        const isQuoted = quote === '"' || quote === "'";

        if (isQuoted) {
            advanceBy(1)
            //获取下一个引号的索引
            const endQuoteIndex = context.source.indexOf(quote);
            if (endQuoteIndex > -1) {
                value = context.source.slice(0, endQuoteIndex);
                // 消费属性值
                advanceBy(value.length);
                //消费引号
                advanceBy(1);
            } else {
                console.error('缺少引号');
            }
        } else {
            // 代码运行到这里，说明属性值没有被引号引用
            // 下一个空白字符之前的内容全部作为属性值
            const match = /^[^\t\r\n\f >]+/.exec(context.source);
            // 获取属性值
            value = match[0];
            // 消费属性值
            advanceBy(value.length);
        }
        // 消费属性值后面的空白字符
        advanceSpaces();
        props.push({
            type: 'Attribute',
            name,
            value
        })
    }
    return props;

}

/**
 * 状态机结束判断
 * @param context
 * @param ancestors
 */
function isEnd(context, ancestors) {
    // 当模板内容解析完毕后，停止
    if (!context.source) return true;
    // 与父级节点栈内所有节点做比较
    for (let i = ancestors.length - 1; i >= 0; i--) {
        //如果遇到结束标签且标签名称和父级标签名称相同，则停止
        if (context.source.startsWith(`</${ancestors[i].tag}`)) {
            return true;
        }
    }
    return false;
}

const namedCharacterReferences = {
    "gt": ">",
    "gt;": ">",
    "lt": "<",
    "lt;": "<",
    "ltcc;": "⪦"
}

function decodeHtml(rawText, asAttr = false) {
    let offset = 0;
    const end = rawText.length;
    //经过编码后的文本将作为返回值被返回
    let decodeText = '';
    //引用表中实体名称的最大长度
    let maxCRNameLength = 0;


    //advance函数用于消费指定长度的文本
    function advance(length) {
        offset += length;
        rawText = rawText.slice(length);
    }

    // 消费字符串，直到处理完毕为止
    while (offset < end) {
        //用于匹配字符引用的开始部分
        const head = /&(?:#x?)?/i.exec(rawText);
        // 如果没有匹配，说明已经没有需要解码的内容
        if (!head) {
            const remaining = end - offset;
            // 将剩余内容加到decodeText上
            decodeText += rawText.slice(0, remaining);
            // 消费剩余内容
            advance(remaining);
            break;
        }
        // head.index 为匹配的字符 & 在 rawText 中的位置索引
        // 截取字符 & 之前的内容加到 decodedText 上
        decodeText += rawText.slice(0, head.index);
        // 消费字符&之前的内容
        advance(head.index);

        // 如果满足条件，则说明是命名字符引用，否则为数字字符引用
        if (head[0] === '$') {
            let name = '';
            let value;
            // 字符 & 的下一个字符必须是 ASCII 字母或数字，这样才是合法的命名字符引用
            if (/[0-9a-z]/i.test(rawText[1])) {
                //根据引用表计算实体名称的最大长度
                if (!maxCRNameLength) {
                    maxCRNameLength = Object.keys(namedCharacterReferences).reduce((max, name) => Math.max(max, name.length), 0);
                }
            }
            // 从最大长度开始对文本进行截取，并试图去引用表中找到对应的项
            for (let length = maxCRNameLength; !value && length > 0; --length) {
                // 截取字符 & 到最大长度之间的字符作为实体名称
                name = rawText.substr(1, length);
                // 使用实体名称去索引表中查找对应项的值
                value = (namedCharacterReferences)[name]
            }
            //如果找到了对应项的值，说明解码成功
            if (value) {
                // 检查实体名称的最后一个匹配字符是否是分号
                const semi = name.endsWith(';');
                // 如果解码的文本作为属性值，最后一个匹配的字符不是分号，
                // 并且最后一个匹配字符的下一个字符是等于号（=）、ASCII 字母或数字，
                // 由于历史原因，将字符 & 和实体名称 name 作为普通文本

                if (asAttr && !semi && /[=a-z0-9]/i.test(rawText[name.length + 1] || '')) {
                    decodeText += '&' + name;
                    advance(1 + name.length);
                } else {
                    // 其他情况下，正常使用解码后的内容拼接到 decodedText 上

                    decodeText += value;
                    advance(1 + name.length)
                }
            } else {
                // 如果没有找到对应的值，说明解码失败
                decodeText += '&' + name;
                advance(1 + name.length);
            }
        } else {
            // 如果字符 & 的下一个字符不是 ASCII 字母或数字，则将字符 & 作为普通文本
            decodeText += '&';
            advance(1);
        }
    }
    return decodeText;
}
