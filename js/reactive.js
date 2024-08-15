let activeEffect = null
//effect栈
let effectStack = []
const bucket = new WeakMap()
//针对for in 循环访问对象属性的情况
const ITERATE_KEY = Symbol()
const triggerType = {
  SET: 'SET',
  ADD: 'ADD',
  DELETE: 'DELETE'
}
// 定义一个 Map 实例，存储原始对象到代理对象的映射
const reactiveMap = new Map()
// 标记是否需要追踪
let shouldTrack = true

//重写数组的部分方法
const arrayInstrumentations = {}
;['includes', 'indexOf', 'lastIndexOf'].forEach(method => {
  const originalMethod = Array.prototype[method]
  arrayInstrumentations[method] = function (...args) {
    let res = originalMethod.apply(this, args)
    if (res === false || -1 === res) {
      res = originalMethod.apply(this.raw, args)
    }
    return res
  }
})
// 重写数组的 push、pop、shift、unshift 以及 splice 方法
;['push', 'pop', 'shift', 'unshift', 'splice'].forEach(method => {
  const originalMethod = Array.prototype[method]
  arrayInstrumentations[method] = function (...args) {
    shouldTrack = false
    let res = originalMethod.apply(this, args)
    shouldTrack = true
    return res
  }
})

/**
 * 副作用函数
 * @param fn
 * @param options
 */
export function effect(fn, options = {}) {
  //effectFn函数执行时机： 第一次手动触发effectFn函数，其目的是为了主动收集依赖； 后面再执行的话，肯定是在set函数中trigger执行。
  const effectFn = () => {
    // 调用 cleanup 函数完成清除工作
    cleanup(effectFn)
    activeEffect = effectFn
    // 在执行副作用之前将当前副作用函数压入栈中
    effectStack.push(effectFn)
    const res = fn()
    // 在当前副作用函数执行完毕以后，将当前副作用函数弹出栈，并把activeEffect还原为之前的值
    effectStack.pop()
    activeEffect = effectStack[effectStack.length - 1]
    return res
  }
  //将options挂载到effectFn上
  effectFn.options = options
  // activeEffect.deps 用来存储所有与该副作用函数相关联的依赖集合
  effectFn.deps = []
  if (!options.lazy) {
    effectFn()
  }
  return effectFn
}

function cleanup(effectFn) {
  const deps = effectFn.deps
  for (let i = 0; i < deps.length; i++) {
    const tempDeps = deps[i]
    //这里删除的，不仅仅是删除了effectFn.deps中的值，同时也删除了deps中依赖的set的值。
    tempDeps.delete(effectFn)
  }
  // 清空
  effectFn.deps.length = 0
}

export function reactive(obj) {
  return createReactive(obj)
}
// 浅响应
export function shallowReactive(obj) {
  return createReactive(obj, true)
}

function readonly(obj) {
  return createReactive(obj, false, true)
}

/**
 * 创建一个响应式
 * @param data
 * @param isShallow  代表是否是浅响应
 * @param isReadonly  表示只读
 * @returns {(string | symbol)[]|*|boolean}
 */
function createReactive(data, isShallow = false, isReadonly = false) {
  data.raw = data
  const existProxy = reactiveMap.get(data)
  if (existProxy) return existProxy
  const proxy = new Proxy(data, {
    get(target, key, receiver) {
      // 当禁止追踪时，直接返回
      // if (!activeEffect || !shouldTrack) return

      // 代理对象可以通过 raw 属性访问原始数据
      if (key === 'raw') {
        return target
      }

      // 如果操作的目标对象是数组，并且 key 存在于arrayInstrumentations 上，那么返回定义在 arrayInstrumentations 上的值
      if (
          Array.isArray(target) &&
          arrayInstrumentations.hasOwnProperty(key)
      ) {
        return Reflect.get(arrayInstrumentations, key, receiver)
      }

      // 非只读属性才需要建立响应关系
      //   key的类型是symbol,则不进行追踪
      if (!isReadonly && typeof key !== 'symbol') {
        track(target, key)
      }
      // 如果读取的是 size 属性,通过指定第三个参数 receiver 为原始对象 target 从而修复问题
      if (key === 'size') {
        return Reflect.get(target, key, target)
      }

      const res = Reflect.get(target, key, receiver);
      if (isShallow) {
        return res
      }

      if (typeof res === 'object' && res !== null) {
        // 如果数据为只读，则调用 readonly 对值进行包装
        return isReadonly ? readonly(res) : reactive(res)
      }
      return res
      // return target[key]
    },
    set(target, key, newVal, receiver) {
      if (isReadonly) {
        console.warn(`属性${key}是只读的`)
        return true
      }
      // console.log(target, receiver)
      const oldValue = target[key]

      // 如果属性不存在，则说明是在添加新属性，否则是设置已有属性
      const type = Array.isArray(target)
          ? Number(key) < target.length
              ? triggerType.SET
              : triggerType.ADD
          : Object.prototype.hasOwnProperty.call(target, key)
              ? triggerType.SET
              : triggerType.ADD
      const res = Reflect.set(target, key, newVal, receiver)
      // target === receiver.raw 说明 receiver 就是 target 的代理对象
      if (target === receiver.raw) {
        //新旧值不相等，且不是NaN
        if (
            oldValue !== newVal &&
            (oldValue === oldValue || newVal === newVal)
        ) {
          trigger(target, key, type, newVal)
        }
      }

      return res
    },
    has(target, p) {
      track(target, p)
      return Reflect.has(target, p)
    },
    deleteProperty(target, p) {
      if (isReadonly) {
        console.warn(`属性${p}是只读的`)
        return true
      }
      const hadKey = Object.prototype.hasOwnProperty.call(target, p)
      const res = Reflect.deleteProperty(target, p)
      if (hadKey && res) {
        trigger(target, p, triggerType.DELETE)
      }
      return res
    },
    ownKeys(target) {
      // 如果操作目标target是数组，则使用length属性作为key并建立响应联系
      track(target, Array.isArray(target) ? 'length' : ITERATE_KEY)
      return Reflect.ownKeys(target)
    }
  })
  reactiveMap.set(data, proxy)
  return proxy
}

/**
 * 追踪函数
 * @param target
 * @param key
 */
function track(target, key) {
  if (!activeEffect) return

  let depsMap = bucket.get(target)
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()))
  }
  let deps = depsMap.get(key)
  if (!deps) {
    depsMap.set(key, (deps = new Set()))
  }
  //在同一个effect函数中，如果一个属性有被多次使用，利用了set集合的去重功能，只会收集一次依赖
  deps.add(activeEffect)
  // deps 就是一个与当前副作用函数存在联系的依赖集合
  // 将其添加到 activeEffect.deps 数组中
  activeEffect.deps.push(deps)
}

/**
 * 触发
 * @param target
 * @param key
 * @param type 表示属性是新增还是修改
 * @param newVal 新的值
 */
function trigger(target, key, type, newVal) {
  const depsMap = bucket.get(target)
  if (!depsMap) return
  // 取得与 key 相关联的副作用函数
  const effects = depsMap.get(key)

  const effectsToRun = new Set()
  // 将与 key 相关联的副作用函数添加到 effectsToRun
  effects &&
  effects.forEach(effectFn => {
    //如果trigger出发执行额副作用函数与当前正在执行的副作用函数相同，则不触发执行
    if (effectFn !== activeEffect) {
      effectsToRun.add(effectFn)
    }
  })
  // 当操作类型为 ADD 并且目标对象是数组时，应该取出并执行那些与 length
  // 属性相关联的副作用函数
  if (type === triggerType.ADD && Array.isArray(target)) {
    //取出和length相关副作用函数
    const lengthEffects = depsMap.get('length')
    lengthEffects &&
    lengthEffects.forEach(effectFn => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn)
      }
    })
  } else if (Array.isArray(target) && key === 'length') {
    // 如果目标对象是数组，且修改的是数组的length属性
    depsMap.forEach((effects, key) => {
      if (key >= newVal) {
        effects.forEach(effectFn => {
          if (effectFn !== activeEffect) {
            effectsToRun.add(effectFn)
          }
        })
      }
    })
  }
  if (type === triggerType.ADD || type === triggerType.DELETE) {
    // 取得与 ITERATE_KEY 相关联的副作用函数
    const iterateEffects = depsMap.get(ITERATE_KEY)
    // 将与 ITERATE_KEY 相关联的副作用函数也添加到 effectsToRun
    iterateEffects &&
    iterateEffects.forEach(effectFn => {
      if (effectFn !== activeEffect) effectsToRun.add(effectFn)
    })
  }

  effectsToRun.forEach(effectFn => {
    // 如果一个副作用函数存在调度器，则调用该调度器、并将副作用函数作为参数传递
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn)
    } else {
      effectFn()
    }
  })
}

//计算属性的方法
function computed(getter) {
  // 缓存变量
  let value = ''
  // 标记是否是脏数据，只有是脏数据的时候才需要重新计算
  let dirty = true

  const effectFn = effect(getter, {
    lazy: true,
    scheduler() {
      dirty = true
      // 当依赖值发生变化时，触发相应
      trigger(obj, 'value')
    }
  })

  const obj = {
    get value() {
      if (dirty) {
        value = effectFn()
        dirty = false
      }
      // 当访问值的时候，手动追踪
      track(obj, 'value')
      return value
    }
  }
  return obj
}

/**
 * 增加watch监听函数
 * @param source
 * @param cb
 */
function watch(source, cb, options = {}) {
  let getter = () => {}
  let oldValue, newValue
  if (typeof source === 'function') {
    getter = source
  } else {
    getter = () => traverse(source)
  }
  // cleanup 用来存储用户注册的过期回调
  let cleanup
  // 定义 onInvalidate 函数
  function onInvalidate(fn) {
    cleanup = fn
  }

  const effectFn = effect(() => getter(), {
    // lazy设置为true，下面会手动触发effectFn
    lazy: true,
    scheduler() {
      if (options.flush === 'post') {
        const p = Promise.resolve()
        p.then(scheduler)
      } else {
        scheduler()
      }
    }
  })

  function scheduler() {
    // 在 scheduler 中重新执行副作用函数，得到的是新值
    newValue = effectFn()
    // 在调用回调函数 cb 之前，先调用过期回调
    if (cleanup) {
      cleanup()
    }
    // 将旧值和新值作为回调函数的参数
    cb(newValue, oldValue, onInvalidate)
    // 更新旧值
    oldValue = newValue
  }

  if (options.immediate) {
    scheduler()
  } else {
    // 手动触发effectFn，获取旧值
    oldValue = effectFn()
  }
}

function traverse(value, seen = new Set()) {
  // 如果要读取的数据是原始值，或者已经被读取过了，那么什么都不做
  if (typeof value !== 'object' || value === null || seen.has(value)) return
  // 将数据添加到 seen 中，代表遍历地读取过了，避免循环引用引起的死循环
  seen.add(value)
  // 假设 value 就是一个对象，使用 for...in 读取对象的每一个值，并递归地 调用 traverse 进行处理

  for (const key in value) {
    traverse(value[key], seen)
  }
  return value
}

//如果不处理，则会报错：Method get Set.prototype.size called on incompatible receiver #<Set>
// const set = new Set([1, 2, 3])
// const setProxy = reactive(set)
// effect(() => {
//   console.log(setProxy.size)
// })

//  Method Set.prototype.delete called on incompatible receiver #<Set>
// const set = new Set([1, 2, 3])
// const setProxy = reactive(set)
// effect(() => {
//   setProxy.delete(1);
// })
