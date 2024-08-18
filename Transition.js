// vue3.js内置组件
//Transition组件本身不会渲染任何额外的内容，它只是通过默认插槽获取过渡元素，并渲染需要过度的元素
const Transition = {
    name: 'Transition',
    setup(props, {slots}) {
        return () => {
            //通过默认插槽获取需要过度的元素
            const innerVNode = slots.default();

            // 在过渡元素的VNode对象上添加transition相应的钩子函数
            innerVNode.transition = {
                // 添加enter-from和enter-active样式
                beforeEnter(el) {
                    // 设置初始状态
                    el.classList.add('enter-from');
                    el.classList.add('enter-active');
                },
                // 在下一帧中移除enter-from类，添加enter-to
                enter(el) {
                    nextFrame(() => {
                        el.classList.remove('enter-from');
                        el.classList.add('enter-to');
                        // 监听transitionend事件完成收尾工作
                        el.addEventListener('transitionend', e => {
                            el.classList.remove('enter-to');
                            el.classList.remove('enter-active');
                        })
                    })

                },
                // 运动结束，移除enter-to和enter-active类
                leave(el, performRemove) {
                    el.classList.add('leave-from');
                    el.classList.add('leave-active');
                    //强制reflow,使得初始状态生效
                    document.body.offsetHeight;
                    // 在下一帧中修改状态
                    nextFrame(() => {
                        el.classList.remove('leave-from');
                        el.classList.add('leave-to');
                    });

                    el.addEventListener('transitionend', e => {
                        el.classList.remove('enter-to');
                        el.classList.remove('enter-active');

                        performRemove();
                    })
                }
            }

            return innerVNode;
        }
    }
}

function nextFrame(fn) {
    requestAnimationFrame(() => {
        requestAnimationFrame(fn)
    })
}
