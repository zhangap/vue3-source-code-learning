// 缓存任务队列，用一个Set数据结构来表示，这样可以自动对任务进行去重
const queue = new Set();
// 标记是否正在刷新队列
let isFlushing = false;

const p = Promise.resolve();


export function queueJob(job) {
    // 将job添加到任务队列queue中
    queue.add(job);
    // 如果还乜有开始刷新队列，则刷新
    if (!isFlushing) {
        //将该标志设置为true，避免重复刷新
        isFlushing = true;
        // 在微任务中舒心缓冲队列
        p.then(() => {
            try {
                queue.forEach(job => job())
            } finally {
                // 重置状态
                isFlushing = false;
                queue.clear();
            }
        })
    }
}
