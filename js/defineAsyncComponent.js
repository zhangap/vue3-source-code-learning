import {Text} from "./render.fast.component.js";

const {ref, shallowRef} = VueReactivity

function onUmounted(param) {

}

/**
 * 异步函数用于定义一个异步组件，接收一个异步组件加载器作为参数
 * @param options
 */
export function defineAsyncComponent(options) {
    // 一个变量，用来存储异步加载的组件
    let InnerComp = null;

    if (typeof options === 'function') {
        options = {
            // 如果options是加载器，则将其格式化为配置项形式
            loader: options
        }
    }
    const {loader} = options;

    return {
        name: 'AsyncComponentWrapper',
        setup() {
            // 记录重复次数
            let retries  = 0;
            // 封装load函数用来加载异步组件
            function load() {
                return loader().catch(err => {
                    if(options.onError) {
                        return new Promise((resolve, reject) => {
                            const retry = () =>{
                                resolve(load())
                                retries++;
                            }
                            const fail = () => reject(err);
                            // 作为onError回调函数的参数，让用户来决定下一步该怎么做
                            options.onError(retry, fail, retries)
                        })
                    } else {
                        throw err;
                    }
                })
            }

            const loaded = ref(false);
            //定义error,当错误发生时，用来存储错误对象
            const error = shallowRef(null);
            // 标记是否正在加载
            const loading = ref(false);

            let loadingTimer = null;
            if (options.delay) {
                loadingTimer = setTimeout(() => {
                    loading.value = true;
                }, options.delay);
            } else {
                // 如果配置项中没有delay，则直接标记为加载中
                loading.value = true;
            }
            // 执行加载器函数,返回一个Promise实例
            // 加载成功后，将加载成功的组件赋值给InnerComp，并将loaded标记true，代表加载成功
            load().then(c => {
                InnerComp = c;
                loaded.value = true;
            }).catch(err => {
                // 添加 catch 语句来捕获加载过程中的错误
                error.value = err;
            }).finally(() => {
                loading.value = false;
                clearTimeout(loadingTimer);
            })
            let timer = null;
            if (options.timeout) {
                timer = setTimeout(() => {
                    error.value = new Error('异步组件超时');
                }, options.timeout)
            }
            // 包装组件被卸载时清除定时器
            onUmounted(() => {
                clearTimeout(timer);
            });
            // 占位内容
            const placeholder = {type: Text, children: ''}

            return () => {
                if (loaded.value) {
                    return {type: InnerComp}
                } else if (error.value && options.errorComponent) {
                    return {type: options.errorComponent, props: {error: error.value}}
                } else if (loading.value && options.loadingComponent) {
                    // 如果异步组件正在加载，并且用户指定了loading组件，则渲染Loading组件
                    return {
                        type: options.loadingComponent,
                    }
                } else {
                    return placeholder;
                }
            }
        }
    }

}

