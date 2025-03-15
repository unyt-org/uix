import { Ref } from "datex-core-legacy/runtime/pointers.ts";

type primitive = string | number | boolean | bigint;

type ExactValue<T, X> = (
	X extends T ? (
		X extends primitive ? (
			X extends Ref<primitive> ?
				never :
				(
					X extends number ? number :
					X extends string ? string :
					X extends boolean ? boolean :
					X extends bigint ? bigint :
					never
				)
		) : (
			T extends X ? X
			: never
		)
		
	)
	: never
);

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

type IndexOf<T extends readonly any[], V, A extends any[] = []> =
	T extends [infer First, ...infer Rest]
		? First extends V
			? A['length']
			: IndexOf<Rest, V, [...A, First]>
		: never;

type ExtendsRef<T> = (Union2Tuple<T>)[0] extends Ref<infer U> ? true : false;
type a = ExtendsRef<Ref<number> | number>;


export type MappedProps<Props extends Record<string, any>, Xs extends any[]> = {
	[K in keyof Props]: 
		// makes sure any of the potential union type e.g. Ref<number> | number is a Ref<number>
		Union2Tuple<Props[K]>[0] extends Ref<infer T> ? T | Ref<T>
		: Union2Tuple<Props[K]>[1] extends Ref<infer T> ? T | Ref<T>
		// when the assigned attribute value is an exact match of the property type, it is valid
		: Xs[IndexOf<Union2Tuple<keyof Props>, K>] extends ExactValue<Props[K], Xs[IndexOf<Union2Tuple<keyof Props>, K>]> ? 
		Xs[IndexOf<Union2Tuple<keyof Props>, K>]
		: never;
};