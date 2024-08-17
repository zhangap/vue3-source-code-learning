import {reactive, effect, shallowReactive, shallowReadonly} from "./reactive.js";
import {queueJob} from "./queue.js";
// 快速diff算法 + 组件化
import {createText, createElement, setText, insert, setElementText} from './browserMethod.js'
import {lis} from "./lis.js";
// 文本节点
export const Text = Symbol('text');
// 注释节点
export const Comment = Symbol('comment');
// 虚拟节点
export const Fragment = Symbol('fragment');

// const { reactive, effect, shallowReactive} = VueReactivity

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
        } else if (typeof type === 'object') {
            if (!n1) {
                mountComponent(n2, container, anchor);
            } else {
                patchComponent(n1, n2, anchor);
            }
        }


    }

    /**
     * 组件挂载
     * @param vnode
     * @param container
     * @param anchor
     */
    function mountComponent(vnode, container, anchor) {
        // 通过vnode获取组件的选项对象，即vnode.type
        const componentOptions = vnode.type;
        //获取组件的渲染函数
        let {
            render,
            data,
            props: propsOption,
            setup,
            beforeCreate = () => {
            },
            created = () => {
            },
            beforeMount = () => {
            },
            mounted = () => {
            },
            beforeUpdate = () => {
            },
            updated = () => {
            }
        } = componentOptions;

        // 执行钩子函数
        beforeCreate();

        // 调用函数 data得到原始值，并调用reactive函数将其包装为响应式数据
        const state = reactive(data ? data() : {});

        const [props, attrs] = resolveProps(propsOption, vnode.props);
        const slots = vnode.children || {};

        //定义组件实例，一个组件实例本质上就是一个对象，它包含与组件有关的状态信息
        const instance = {
            // 组件的自身状态数据
            state,
            props: shallowReactive(props),
            isMounted: false,
            // 组件自身所渲染的内容，即子树
            subTree: null,
            // 将插槽添加到组件实例上
            slots,
            // 在组件实例中添加mounted数组，用来存储通过onMounted函数注册的生命周期钩子函数
            mounted: []
        }

        /**
         * 定义emit函数，它接收两个参数
         * @param event 事件名称
         * @param payload 传递给事件处理函数的参数
         */
        function emit(event, ...payload) {
            const eventName = `on${event[0].toUpperCase()}` + event.slice(1);
            // 根据处理后的事件名称去props中寻找对应的事件处理函数
            const handler = instance.props[eventName];
            if (handler) {
                handler(...payload);
            } else {
                console.error('事件不存在');
            }
        }
        //setupContext，由于我们还没有讲解emit和slots，所以暂时只需要attrs
        const setupContext = {attrs, emit, slots}
        //setupState用来存储由setup返回的数据
        let setupState = null;
        // setup
        if (setup && typeof setup === 'function') {
            setCurrentInstance(instance)
            // 调用setup函数，将只读版本的props作为第一个参数传递，避免用户以外地址修改为props的值
            const setupResult = setup(shallowReadonly(instance.props), setupContext)

            //如果setup函数的返回值是函数，则将其作为渲染函数
            if (typeof setupResult === "function") {
                //报告冲突
                if (render) console.error('setup函数返回渲染函数，render选项将被忽略');
                render = setupResult
            } else {
                // 如果setup的返回值不是函数，则作为数据状态赋值给setupState
                setupState = setupResult;
            }
            // 在setup函数执行完毕后，重置当前实例
            setCurrentInstance(null);
        }
        // 将组件实例设置到vnode上，用于后续更新
        vnode.component = instance;

        // 创建上下文对象，本质上是组件实例的代理
        const renderContext = new Proxy(instance, {
            get(target, p, receiver) {
                const {state, props} = target;
                if(p === '$slots') return slots;
                if (state && p in state) {
                    return state[p];
                } else if (p in props) {
                    return props[p];
                } else if (setupState && p in setupState) {
                    //渲染上下文需要增加对setupState的支持
                    return setupState[p];
                } else {
                    console.error('不存在')
                }
            },
            set(target, p, newValue, receiver) {
                const {state, props} = target;
                if (state && p in state) {
                    state[p] = newValue;
                } else if (p in props) {
                    console.error('属性只读')
                } else if (setupState && p in setupState) {
                    // 渲染上下文需要增加对setupState的支持
                    setupState[p] = newValue;
                } else {
                    console.error('不存在')
                }
            }
        })

        created.call(renderContext);

        // 将组件的render函数调用包装到effect中
        effect(() => {
            // 执行渲染函数，获取组件的渲染内容，即render函数返回的虚拟DOM
            const subTree = render.call(renderContext);
            // 初次挂载
            if (!instance.isMounted) {
                beforeMount.call(renderContext);
                // 最后调用patch函数挂载组件所描述的内容，即subTree
                patch(null, subTree, container, anchor);
                instance.isMounted = true;
                mounted.call(renderContext);
                //遍历instance.mounted数组并逐个执行即可
                instance.mounted && instance.mounted.forEach(hook => {
                    hook.call(renderContext);
                })
            } else {
                beforeUpdate();
                patch(instance.subTree, subTree, container, anchor);
                updated.call(renderContext);
            }
            instance.subTree = subTree;
        }, {
            //指定改副作用函数的调度器为queueJob即可
            scheduler: queueJob
        })

    }

    /**
     * 组件打补丁（更新）
     * @param n1
     * @param n2
     * @param anchor
     */
    function patchComponent(n1, n2, anchor) {
        const instance = (n2.component = n1.component);
        //获取当前的props数据
        const props = instance.props;
        // 调用hasPropsChanged检测为子组件传递的props是否发生变化，如果没有变化，则不需要更新
        if (hasPropsChanged(n1.props, n2.props)) {
            const [nextProps] = resolveProps(n2.type.props, n2.props);
            // 更新props
            for (const k in nextProps) {
                props[k] = nextProps[k];
            }
            //删除不存在的props
            for (const k in props) {
                if (!(k in nextProps)) delete props[k];
            }
        }
    }

    function hasPropsChanged(prevProps, nextProps) {
        const nextKeys = Object.keys(nextProps);
        //如果新旧props的数量变了，说明有变化
        if (nextKeys.length !== Object.keys(prevProps).length) {
            return true;
        }
        for (let i = 0; i < nextKeys.length; i++) {
            const key = nextKeys[i];
            if (nextProps[key] !== prevProps[key]) {
                return true
            }
        }
        return false;
    }

    /**
     * 用于解析组件props和attrs数据
     * @param options
     * @param propsData
     */
    function resolveProps(options = {}, propsData) {
        const props = {};
        const attrs = {};
        //遍历为组件传递的props数据
        for (const key in propsData) {
            // 以字符串on开头的props,无论是否显示地声明，都将其添加到props数据中，而不是添加到attrs中
            if (key in options || key.startsWith('on')) {
                props[key] = propsData[key]
            } else {
                attrs[key] = propsData[key];
            }
        }
        return [props, attrs]
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

        // 处理相同的前置节点
        // 索引j指向新旧两组子节点的开头
        let j = 0;
        let oldVNode = oldChildren[j];
        let newVNode = newChildren[j];
        //while循环向后遍历，直到遇到相同不同key值的节点为止
        while (oldVNode.key === newVNode.key) {
            //调用patch函数进行更新
            patch(oldVNode, newVNode, container);
            // 更新索引值，让其递增
            j++;
            oldVNode = oldChildren[j];
            newVNode = newChildren[j];
        }
        //处理相同的后置节点
        let oldEndIndex = oldChildren.length - 1;
        let newEndIndex = newChildren.length - 1;
        oldVNode = oldChildren[oldEndIndex];
        newVNode = newChildren[newEndIndex];

        while (oldVNode.key === newVNode.key) {
            // 调用patch函数进行更新
            patch(oldVNode, newVNode, container);
            // 递减oldEndIndex和newEndIndex
            oldEndIndex--;
            newEndIndex--;
            oldVNode = oldChildren[oldEndIndex];
            newVNode = newChildren[newEndIndex];
        }

        // 预处理完毕后，如果满足如下条件，则说明从j-->newEnd之间的节点应作为新节点插入
        if (j > oldEndIndex && j <= newEndIndex) {
            //锚点的索引
            const anchorIndex = newEndIndex + 1;
            const anchor = anchorIndex < newChildren.length ? newChildren[anchorIndex].el : null;
            // 采用while循环，调用patch逐个挂载新节点
            while (j <= newEndIndex) {
                patch(null, newChildren[j++], container, anchor);
            }
        } else if (j > newEndIndex && j <= oldEndIndex) {
            //j --> oldEndIndex之间的节点都应该被卸载
            while (j <= oldEndIndex) {
                unmount(oldChildren[j++]);
            }
        } else {
            //增加else来判断非理想情况
            //构造一个数组source用来存储新的子节点剩余未处理节点
            const count = newEndIndex - j + 1;
            const source = new Array(count);
            source.fill(-1);

            // oldStart和newStart分别为起始索引
            const oldStart = j;
            const newStart = j;

            // 新增两个变量moved和pos
            let moved = false;
            let pos = 0;

            // 构建索引表
            const keyIndex = {};
            for (let i = newStart; i <= newEndIndex; i++) {
                keyIndex[newChildren[i].key] = i;
            }
            // 新增patched变量，代表更新过的节点数量
            let patched = 0;
            for (let i = oldStart; i <= oldEndIndex; i++) {
                const oldVNode = oldChildren[i];
                //如果更新过的节点数量小于等于需要更新的节点数量，则执行更新
                if (patched <= count) {
                    const k = keyIndex[oldVNode.key];
                    if (typeof k !== 'undefined') {
                        newVNode = newChildren[k];
                        patch(oldVNode, newVNode, container);
                        patched++;
                        //填充source数组
                        source[k - newStart] = i;
                        //判断节点是否需要移动
                        if (k < pos) {
                            moved = true;
                        } else {
                            pos = k;
                        }
                    } else {
                        //没找到
                        unmount(oldVNode);
                    }
                } else {
                    unmount(oldVNode)
                }

            }

            if (moved) {
                //如果moved为真，则需要进行DOM移动操作
                // 计算最长递增子序列
                const seq = lis(source);
                // s指向最长递增子序列的最后一个元素
                let s = seq.length - 1;
                let i = count - 1;

                for (i; i >= 0; i--) {
                    if (source[i] === -1) {
                        const pos = i + newStart;
                        const newVNode = newChildren[pos];
                        const nextPos = pos + 1;
                        //锚点
                        const anchor = nextPos < newChildren.length ? newChildren[nextPos].el : null;
                        patch(null, newVNode, container, anchor);
                    } else if (i !== seq[s]) {
                        //如果节点的索引i不等于seq[s]的值，说明该节点需要移动
                        const pos = i + newStart;
                        const newVNode = newChildren[pos];
                        //该节点的下一个节点的位置索引
                        const nextPos = pos + 1;
                        //锚点
                        const anchor = nextPos < newChildren.length ? newChildren[nextPos].el : null;
                        insert(newVNode.el, container, anchor);
                    } else {
                        // 当 i=== seq[s]时，说明该位置的节点不需要移动
                        //只需要让s指向下一个位置
                        s--;
                    }
                }
            }
        }
    }

    /**
     * 挂载元素
     * @param vnode
     * @param container
     * @param anchor
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
        } else if(typeof vnode.type === 'object') {
            //对于组件的卸载，本质上要卸载组件爱你所渲染的内容，即subTree
            unmount(vnode.component.subTree);
            return;
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

// 全局变量，存储当前正在被初始化的组件实例
let currentInstance = null;
//该方法接收组件实例作为参数，并将实例设置为currentInstance
function setCurrentInstance(instance) {
    currentInstance = instance;
}
/**
 * onMounted函数的实现
 * @param fn
 */
function onMounted(fn) {
    if(currentInstance) {
        currentInstance.onMounted.push(fn);
    } else {
        console.log('onMounted函数只能在setup函数中使用')
    }
}


export const renderer = createRenderer({
    createElement,
    createText,
    setText,
    setElementText,
    insert,
    patchProps
});





