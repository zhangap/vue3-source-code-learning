// 创建元素
export function createElement(tag) {
    return document.createElement(tag);
    // return {
    //     tag
    // }
}

// 设置文本节点
export function setElementText(el, text) {
    // console.log(`设置 ${JSON.stringify(el)} 的文本内容：${text}`);
    el.textContent = text;
}

// 插入元素
export function insert(el, parent, anchor = null) {
    // console.log(`将 ${JSON.stringify(el)} 添加到${JSON.stringify(parent)} 下`);
    parent.insertBefore(el, anchor)
}
export function createText(text) {
    return document.createTextNode(text);
}

// 设置文本节点的值
export function setText(el,text) {
    el.nodeValue = text;
}
