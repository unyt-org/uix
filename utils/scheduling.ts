export class TaskScheduler<T = unknown> {
	private queue: (() => Promise<T>)[] = [];
	private isRunning = false;
	private map: Map<() => Promise<T>, {
		resolve: (arg: T) => void,
		reject: (error: unknown) => unknown
	}> = new Map();

	constructor(private readonly useLatestTask = false) {}

	public schedule(task: () => Promise<T>) {
		this.queue.push(task);
		const promise = new Promise<T>((resolve, reject) => {
			this.map.set(task, {resolve, reject})
		});
		if (!this.isRunning)
			this.next();
		return promise;
	}

	private async next() {
		if (this.queue.length) {
			if (this.useLatestTask) {
				for (const task of this.queue.slice(0, -1))
					this.map.delete(task);
				this.queue = this.queue.slice(-1)
			}
			this.isRunning = true;
			const task = this.queue.shift()!;
			const {resolve, reject} = this.map.get(task)!;
			this.map.delete(task);
			try {
				resolve(await task());
			} catch (e) {
				reject(e);
			}
			this.isRunning = false;
			this.next();
		}
	}
}

export function Task<T>(method: (resolve: (res?: T) => void, reject?: (e?: unknown) => void) => Promise<T> | T) {
	return () => new Promise(async (resolve, reject) => {
		try {
			await method(resolve, reject);
		} catch (e) {
			reject?.(e)
		}
	});
}