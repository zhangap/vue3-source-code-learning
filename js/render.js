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
            // 说明新的子节点是一组子节点
            if (Array.isArray(n1.children)) {
                const oldChildren = n1.children;
                const newChildren = n2.children;

                // 用来存储寻找过程中遇到的最大索引
                let lastIndex = 0;
                // 遍历新的children(先看key值是否相同)
                for (let i = 0; i < newChildren.length; i++) {
                    const newVNode = newChildren[i];
                    //遍历旧的children
                    let j = 0;
                    // 在第一层循环中定义变量find，代表是否在旧的一组子节点中找到可复用的节点，初始值为false，代表没找到
                    let find = false;
                    for (j; j < oldChildren.length; j++) {
                        const oldVNode = oldChildren[j];
                        if (newVNode.key === oldVNode.key) {
                            find = true;
                            patch(oldVNode, newVNode, container);
                            if (j < lastIndex) {
                                //如果当前找到的节点在旧children中的索引小于最小索引值lastIndex
                                const prevVNode = newChildren[i - 1];
                                if (prevVNode) {
                                    const anchor = prevVNode.el.nextSibling;
                                    insert(newVNode.el, container, anchor);
                                }
                            } else {
                                // 如果当前找到的节点在旧children中的索引不小于最大索引值，则更新lastIndex的值
                                lastIndex = j;
                            }
                            break;
                        }
                    }
                    //代码运行到这里，find如果为false，说明当前newVNode没有在旧的一组子节点中找到可复用的节点
                    //也就是说，当前newVNode是新增节点，需要挂载
                    if(!find) {
                        // 为了将节点挂载到正确位置，我们需要先获取锚点元素
                        // 首先获取当前 newVNode 的前一个 vnode 节点
                        const prevVNode = newChildren[i - 1];
                        let anchor = null;
                        if(prevVNode) {
                            anchor = prevVNode.el.nextSibling;
                        } else {
                            //如果没有前一个vnode，则使用它的下一个兄弟节点作为锚点元素,这个时候，我们使用容器元素的firstChild作为锚点
                            anchor = container.firstChild;
                        }
                        patch(null, newVNode, container, anchor);
                    }
                }

                // 上一步更新操作完成后，遍历旧的一组子节点，看是否有需要删除的元素
                for(let i = 0 ; i < oldChildren.length; i++) {
                    const oldVNode = oldChildren[i];
                    const has = newChildren.find(child => child.key === oldVNode.key);
                    //如果在新的一组的子节点中没有找到key值相同的节点，就要删除已经存在的旧节点
                    if(!has) {
                        unmount(oldVNode)
                    }
                }


                //以下代码是简单的diff功能
                // 旧节点长度
                // const oldLen = oldChildren.length;
                // 新的子节点长度
                // const newLen = newChildren.length;
                // 两组子节点的公共长度，即两者中较短的那一组子节点的长度
                // const commonLen = Math.min(oldLen, newLen);
                // for (let i = 0; i < commonLen; i++) {
                //     // 调用patch函数逐个更新子节点
                //     patch(oldChildren[i], newChildren[i], container);
                // }
                // 如果 newLen > oldLen，说明有新子节点需要挂载
                // if (newLen > oldLen) {
                //     for (let i = commonLen; i < newLen; i++) {
                //         patch(null, newChildren[i], container);
                //     }
                // } else if (oldLen > newLen) {
                //     // 如果oldLen > newLen,说明有旧子节点需要卸载
                //     for (let i = commonLen; i < oldLen; i++) {
                //         unmount(oldChildren[i]);
                //     }
                // }
            } else {
                setElementText(container, '');
                n2.children.forEach(child => patch(null, child, container));
            }
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





