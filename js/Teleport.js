const Teleport = {
    __isTeleport: true,
    //处理渲染逻辑
    process(n1, n2, container, anchor, internals) {
        //internals参数中包含了渲染器的内部方法
        const {patch, patchChildren, move} = internals
        if (!n1) {
            //挂载
            const target = typeof n2.props.to === 'string' ? document.querySelector(n2.props.to) : n2.props.to;
            // 将n2.children渲染到指定挂载点即可
            n2.children.forEach(child => {
                patch(null, c, target, anchor);
            })
        } else {
            //更新
            patchChildren(n1, n2, container);
            // 如果新旧to参数的值不同，则需要对内容进行移动
            if(n2.props.to !== n1.props.to) {
                //获取新的容器
                const newTarget = typeof n2.props.to === 'string' ? document.querySelector(n2.props.to) : n2.props.to;
                // 移动到新的容器
                n2.children.forEach(child => { move(c, newTarget)})
            }
        }
    }
}
