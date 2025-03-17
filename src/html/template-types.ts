import type { Ref } from "datex-core-legacy/runtime/pointers.ts";

type Contra<T> =
	T extends any 
	? (arg: T) => void 
	: never;

type InferContra<T> = 
	[T] extends [(arg: infer I) => void] 
	? I 
	: never;
type PickOne<T> = InferContra<InferContra<Contra<Contra<T>>>>;

type Union2Tuple<T> =
	PickOne<T> extends infer U                  // assign PickOne<T> to U
	? Exclude<T, U> extends never               // T and U are the same
		? [T]
		: [...Union2Tuple<Exclude<T, U>>, U]    // recursion
	: never;

interface NotRef {
	__ref__?: void
}

export type MappedProps<Props extends Record<string, unknown>> = {
	[K in keyof Props]: 
		Props[K] extends Ref<infer T> ? T | Ref<T>
		: (
			// if Props[K] allows Ref values (only for unions up to 4)
			Union2Tuple<Props[K]>[0] extends Ref<infer T> ? Props[K]|T :
			Union2Tuple<Props[K]>[1] extends Ref<infer T> ? Props[K]|T :
			Union2Tuple<Props[K]>[2] extends Ref<infer T> ? Props[K]|T :
			Union2Tuple<Props[K]>[3] extends Ref<infer T> ? Props[K]|T :
			// else if Props[K] does not allow Ref values
			Props[K] & NotRef
		)
};