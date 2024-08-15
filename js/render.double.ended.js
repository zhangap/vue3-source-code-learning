import {createText, createElement, setText, insert, setElementText} from './browserMethod.js'
// 文本节点
const Text = Symbol('text');
// 注释节点
const Comment = Symbol('comment');
// 虚拟节点
const Fragment = Symbol('fragment');

// 创建渲染器函数
function createRenderer(options) {

    const {createElement, createText, setText, setElementText, insert, patchProps} = options

    function render(vnode, container) {
        if (vnode) {
            patch(container._vnode, vnode, container);
        } else {
            if (container._vnode) {
                // 调用unmount函数卸载vnode
                unmount(container._vnode);
            }
        }
        container._vnode = vnode;
    }

    /**
     *
     * @param n1 旧的vnode
     * @param n2 新的vnode
     * @param container 容器
     * @param anchor 锚点
     */
    function patch(n1, n2, container, anchor) {

        if (n1 && n1.type !== n2.type) {
            unmount(n1)
            n1 = null;
        }
        const {type} = n2;
        // 如果n2.type的值是字符串类型，则它描述的是普通标签元素
        if (typeof type === "string") {
            // 如果n1不存在，意味着挂载，则调用mountElement函数
            if (!n1) {
                mountElement(n2, container, anchor);
            } else {
                //打补丁(更新)
                patchElement(n1, n2);
            }
        } else if (type === Text) {
            // 如果没有旧节点，则创建
            if (!n1) {
                const el = n2.el = createText(n2.children);
                insert(el, container);
            } else {
                const el = n2.el = n1.el;
                if (n2.children !== n1.children) {
                    // 使用文本节点的nodeValue属性,更新文本节点
                    setText(el, n2.children);
                }
                //如果新旧子节点相同，什么都不做
            }
        } else if (type === Fragment) {
            // 如果旧 vnode 不存在，则只需要将 Fragment 的 children 逐个挂载
            // 即可
            if (!n1) {
                n2.children.forEach(child => patch(null, child, container))
            } else {
                // 如果旧vnode存在，则，则只需要更新Fragment的children即可
                patchChildren(n1, n2, container);
            }
        }


    }

    //元素打补丁
    function patchElement(n1, n2) {
        const el = n2.el = n1.el;

        const oldProps = n1.props;
        const newProps = n2.props;

        //第一步更新props
        for (const key in newProps) {
            if (newProps[key] !== oldProps[key]) {
                patchProps(el, key, oldProps[key], newProps[key]);
            }
        }
        for (const key in oldProps) {
            if (!(key in oldProps)) {
                patchProps(el, key, oldProps[key], null);
            }
        }
        //第二步、更新children
        patchChildren(n1, n2, el);
    }

    // 更新子节点
    function patchChildren(n1, n2, container) {
        // 判断子节点是否是文本节点、
        if (typeof n2.children === 'string') {
            //旧的子节点类型有三种情况：没有子节点、文本子节点和一组子节点
            if (Array.isArray(n1.children)) {
                n1.children.forEach(child => unmount(child));
            }
            setElementText(container, n2.children);
        } else if (Array.isArray(n2.children)) {
            patchKeyedChildren(n1, n2, container);
        } else {
            //新子节点不存在，旧子节点是一组子节点，只需要逐个卸载即可
            if (Array.isArray(n1.children)) {
                n1.children.forEach(child => unmount(child));
            } else if (typeof n1.children === 'string') {
                // 旧子节点是文本子节点，清空内容即可
                setElementText(container, '');
            }
        }
    }

    /**
     * 双端diff算法
     * @param n1 旧
     * @param n2 新
     * @param container
     */
    function patchKeyedChildren(n1, n2, container) {
        const oldChildren = n1.children;
        const newChildren = n2.children;
        //四个索引值
        let oldStartIndex = 0;
        let oldEndIndex = oldChildren.length - 1;
        let newStartIndex = 0;
        let newEndIndex = newChildren.length - 1;

        //四个索引指向的vnode节点
        let oldStartVNode = oldChildren[oldStartIndex];
        let oldEndVNode = oldChildren[oldEndIndex];
        let newStartVNode = newChildren[newStartIndex];
        let newEndVNode = newChildren[newEndIndex];

        //双端比较的逻辑： 头(old)比头、尾(old)比尾、头(old)比尾、尾(old)比头
        while (oldStartIndex <= oldEndIndex && newStartIndex <= newEndIndex) {
            //增加判断分支：如果头部或者是尾部节点为undefined，则说明该节点已经被处理过的，直接跳转到下一个位置
            if (!oldStartVNode) {
                oldStartVNode = oldChildren[++oldStartIndex];
            } else if (!oldEndVNode) {
                oldEndVNode = oldChildren[--oldEndIndex];
            } else if (oldStartVNode.key === newStartVNode.key) {
                patch(oldStartVNode, newStartVNode, container);
                // 更新相关索引
                oldStartVNode = oldChildren[++oldStartIndex];
                newStartVNode = newChildren[++newStartIndex];
            } else if (oldEndVNode.key === newEndVNode.key) {
                // 节点在新的顺序中仍处于尾部，不需要移动，但仍需要打补丁
                patch(oldEndVNode, newEndVNode, container);
                // 更新索引和尾部节点变量
                oldEndVNode = oldChildren[--oldEndIndex];
                newEndVNode = newChildren[--newEndIndex];
            } else if (oldStartVNode.key === newEndVNode.key) {
                patch(oldStartVNode, newEndVNode, container);
                insert(oldStartVNode.el, container, oldEndVNode.el.nextSibling);
                // 更新相关索引
                oldStartVNode = oldChildren[++oldStartIndex];
                newEndVNode = newChildren[--newEndIndex];
            } else if (oldEndVNode.key === newStartVNode.key) {
                patch(oldEndVNode, newStartVNode, container);
                // oldEndVNode.el 移动到 oldStartVNode.el 前面
                insert(oldEndVNode.el, container, oldStartVNode.el);

                //移动dom完成后，更新索引值，并指向下一个位置
                oldEndVNode = oldChildren[--oldEndIndex];
                newStartVNode = newChildren[++newStartIndex];
            } else {
                //遍历旧的一组子节点，试图寻找与newStartVNode拥有相同key值的节点
                const indexInOld = oldChildren.findIndex(node => {
                    return node.key === newStartVNode.key;
                });

                //如果indexInOld大于0，说明找到可复用的节点，并且需要将其对应的真实DOM移动到头部
                if (indexInOld > 0) {
                    const vnodeToMove = oldChildren[indexInOld];
                    patch(vnodeToMove, newStartVNode, container);
                    //将vnodeToMove.el移动到头部节点oldStartVNode.el之前，因此使用后者作为锚点
                    insert(vnodeToMove.el, container, oldStartVNode.el);
                    // 由于位置indexInOld处的节点所对应的真实DOM已经移动到了别处，因此将其设置为undefined
                    oldChildren[indexInOld] = undefined;
                    // 最后更新newStartIndex到下一个位置
                    newStartVNode = newChildren[++newStartIndex];
                } else {
                    //新增节点: 将newStartVNode作为新节点挂载到头部，使用当前节点头部节点oldStartVNode.el作为锚点
                    patch(null, newStartVNode, container, oldStartVNode.el)
                }
                newStartVNode = newChildren[++newStartIndex];

            }
        }
        // 循环结束后检查索引值的情况
        if(oldEndIndex < oldStartIndex && newStartIndex <= newEndIndex) {
            // 如果满足条件，则说明有新的节点遗留，需要挂载它们
            for(let i = newStartIndex;  i<= newEndIndex; i++) {
                patch(null, newChildren[i], container, oldStartVNode.el)
            }
        } else if(newEndIndex < newStartIndex && oldEndIndex <= oldEndIndex) {
            //如果条件满足，说明要移除节点
            for(let i = oldStartIndex; i <= oldEndIndex; i++) {
                unmount(oldChildren[i])
            }
        }
    }

    /**
     * 挂载元素
     * @param vnode
     * @param container
     */
    function mountElement(vnode, container, anchor) {
        // 创建dom元素
        const el = vnode.el = createElement(vnode.type);
        // 文本节点
        if (typeof vnode.children === 'string') {
            setElementText(el, vnode.children);
        } else if (Array.isArray(vnode.children)) {
            // 如果 children 是数组，则遍历每一个子节点，并调用 patch 函数挂载它们
            vnode.children.forEach(child => {
                patch(null, child, el);
            })
        }
        if (vnode.props) {
            for (const key in vnode.props) {
                patchProps(el, key, null, vnode.props[key]);
            }
        }
        // 在插入节点时，将锚点元素透传给insert函数
        insert(el, container, anchor);
    }

    // 卸载
    function unmount(vnode) {
        if (vnode.type === Fragment) {
            vnode.children.forEach(child => unmount(child));
            return
        }
        const parent = vnode.el.parentNode;
        if (parent) parent.removeChild(vnode.el);
    }

    return {
        render
    }
}

// 判断是否需要用props来设置属性
function shouldSetProps(el, key, value) {
    if (key === 'form' && el.tagName === 'INPUT') return false;
    return key in el;
}

// 属性打补丁
function patchProps(el, key, preValue, nextValue) {
    // 事件处理
    if (/^on/.test(key)) {
        //获取为该元素伪造的事件处理函数invoker
        // 定义 el._vei 为一个对象，存在事件名称到事件处理函数的映射
        const invokers = el._vei || (el._vei = {});
        const name = key.slice(2).toLowerCase();
        let invoker = invokers[key];
        if (nextValue) {
            if (!invoker) {
                invoker = el._vei[key] = e => {
                    // 如果事件发生的时间早于事件处理函数绑定的时间，则不执行事件处理函数
                    if (e.timeStamp < invoker.attached) return;
                    // console.log(e.timeStamp)
                    // 如果invoker.value是数组，说明同一类型的事件绑定了多个，此时需要遍历执行
                    if (Array.isArray(invoker.value)) {
                        invoker.value.forEach(fn => {
                            fn(e)
                        })
                    } else {
                        invoker.value(e);
                    }
                }
                invoker.value = nextValue;
                //提那家invoker.attached属性，存储事件处理函数被绑定的时间
                invoker.attached = performance.now();
                el.addEventListener(name, invoker);
            } else {
                invoker.value = nextValue;
            }
        } else if (invoker) {
            el.removeEventListener(name, invoker);
        }
    } else if (key === 'class') {
        // 这里应该调用normalizeClass来格式化class
        el.className = nextValue;
    } else if (shouldSetProps(el, key, nextValue)) {
        // 使用 shouldSetAsProps 函数判断是否应该作为 DOM Properties设置
        const type = typeof el[key];
        if (type === 'boolean' && nextValue === '') {
            el[key] = true;
        } else {
            el[key] = nextValue;
        }
    } else {
        //如果呀设置的属性没有对应的DOM properties ,则使用setAttribute属性来处理、
        el.setAttribute(key, nextValue);
    }
}

//格式化class
function normalizeClass() {

}


export const renderer = createRenderer({
    createElement,
    createText,
    setText,
    setElementText,
    insert,
    patchProps
});





