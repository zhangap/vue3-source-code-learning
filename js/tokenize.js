// 定义状态机的状态
const State = {
    // 初始状态
    initial: 1,
    // 标签开始状态
    tagOpen: 2,
    // 标签名称状态
    tagName: 3,
    // 文本状态
    text: 4,
    // 结束标签状态
    tagEnd: 5,
    // 结束标签名称状态
    tagEndName: 6
};

// 判断是否是字母
function isAlpha(char) {
    return char >= 'a' && char <= 'z' || char >= 'A' && char <= 'Z' || char === ' ';
}

/**
 * 状态机工作原理
 * @param str
 */
//接收模版字符串作为参数，并将模板切割为token返回
export function tokenize(str) {

    let currentState = State.initial
    //用于缓存字符
    const chars = []
    const tokens = []

    while (str) {
        // 查看第一个字符
        const char = str[0]
        switch (currentState) {
            case State.initial:
                if (char === '<') {
                    // 切换状态
                    currentState = State.tagOpen
                    str = str.slice(1)
                } else if (isAlpha(char)) {
                    // 遇到字母、切换到文本状态
                    currentState = State.text
                    chars.push(char)
                    str = str.slice(1)
                }

                break;
            case State.tagOpen:
                if (isAlpha(char)) {
                    currentState = State.tagName
                    chars.push(char)
                    str = str.slice(1)
                } else if (char === '/') {
                    currentState = State.tagEnd
                    str = str.slice(1)
                }

                break;
            case State.tagName:
                if (isAlpha(char)) {
                    // 遇到字母，由于当前处于标签名称状态，所以不需要切换状态
                    chars.push(char)
                    str = str.slice(1)
                } else if (char === '>') {
                    // 标签结束，切换到初始状态
                    currentState = State.initial
                    // 同时创建一个标签token，并添加到tokens数组中
                    tokens.push({
                        type: 'tag',
                        name: chars.join('') // 注意此时chars数组中缓存的字符就是标签名称
                    })
                    //chars中数据已经被消费，需要清空
                    chars.length = 0
                    str = str.slice(1)
                }

                break;
            case State.text:
                if (isAlpha(char)) {
                    chars.push(char)
                    str = str.slice(1)
                } else if (char === '<') {
                    // 遇到<,切换到标签开始状态
                    currentState = State.tagOpen
                    tokens.push({
                        type: 'text',
                        content: chars.join('') //注意此时chars数组中的内容是文本内容
                    })
                    chars.length = 0
                    str = str.slice(1)
                }

                break;
            case State.tagEnd:
                if (isAlpha(char)) {
                    currentState = State.tagEndName
                    chars.push(char)
                    str = str.slice(1)
                }

                break;
            case State.tagEndName:
                if (isAlpha(char)) {
                    chars.push(char)
                    str = str.slice(1)
                } else if (char === '>') {
                    currentState = State.initial
                    tokens.push({
                        type: 'tagEnd',
                        name: chars.join('')
                    })
                    chars.length = 0
                    str = str.slice(1)
                }

                break;
        }
    }
    return tokens;
}
