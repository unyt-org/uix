
// semphore for executing async functions in the right order 
export class Semaphore {

    private currentRequests = [];
    private runningRequests = 0;
    private constructor(key:object, private maxConcurrentRequests = 1) {
        Semaphore.semaphores.set(key, this);
    }

    private static semaphores:WeakMap<object, Semaphore> = new WeakMap();

    static get(key:object) {
        return this.semaphores.get(key) ?? new Semaphore(key);
    }  

    execute(fn:()=>void|Promise<void>) {
        return new Promise((resolve, reject) => {
            this.currentRequests.push({resolve,reject,fn});
            this.tryNext();
        });
    }

    tryNext() {
        if (!this.currentRequests.length) {
            return;
        } else if (this.runningRequests < this.maxConcurrentRequests) {
            let { resolve, reject, fn } = this.currentRequests.shift();
            this.runningRequests++;
            fn().then(() => resolve())
                .catch((err) => reject(err))
                .finally(() => {
                    this.runningRequests--;
                    this.tryNext();
                });
        }
    }
}
