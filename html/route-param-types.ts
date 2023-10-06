/**
 * Expirmental, not yet working with entrypoint maps until generic type parameter inference
 * is supported in TS (https://github.com/microsoft/TypeScript/issues/32794)
 */


type Separator = '/'|'-'
type Other = Exclude<string,':'>;
type Label = Exclude<string,':'|Separator>

type GenericPath<T extends Label, U extends Label, V extends Label, W extends Label> = 
	`${Other}:${T}${
		`${Separator|''}${Other}:${U}${
			`${Separator|''}${Other}:${V}${
				`${Separator|''}${Other}:${W}` | '' | `${Separator}${Other|''}`
			}` | '' | `${Separator}${Other|''}`
		}` | '' | `${Separator}${Other|''}`
	}`

type UnionToIoF<U> =
    (U extends any ? (k: (x: U) => void) => void : never) extends
    ((k: infer I) => void) ? I : never

// return last element from Union
type UnionPop<U> = UnionToIoF<U> extends { (a: infer A): void; } ? A : never;

// prepend an element to a tuple.
type Prepend<U, T extends any[]> =
    ((a: U, ...r: T) => void) extends (...r: infer R) => void ? R : never;

type UnionToTupleRecursively<Union, Result extends any[]> = {
    1: Result;
    0: UnionToTupleRecursively_<Union, UnionPop<Union>, Result>;
    // 0: UnionToTupleRecursively<Exclude<Union, UnionPop<Union>>, Prepend<UnionPop<Union>, Result>>
}[[Union] extends [never] ? 1 : 0];

type UnionToTupleRecursively_<Union, Element, Result extends any[]> =
    UnionToTupleRecursively<Exclude<Union, Element>, Prepend<Element, Result>>;

type UnionToTuple<U> = UnionToTupleRecursively<U, []>;

// Borrowed from SimplyTyped:
type Prev<T extends number> = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62][T];

// Actual, legit sorcery
// Borrowed from pelotom/hkts:
type GetLength<original extends any[]> = original extends { length: infer L } ? L : never
type GetLast<original extends any[]> = original[Prev<GetLength<original>>]

type GetLastOrPrevious<original extends any[], Len = GetLength<original>> = 
	Len extends 1 ? original[0] : original[1]



type Cleared<Tuple extends [...any[]]> = {
	[Index in keyof Tuple]: Equals<Tuple[Index], string> extends true ? never : Tuple[Index];
}
type Keys<Tuple extends [...any[]]> = Cleared<Tuple>[number]
type ParamsObject<Tuple extends [...any[]]> = {
	[key in Keys<Tuple>]: string
}

type CombinedParamsObject<T,U,V,W> = ParamsObject<[
	GetLastOrPrevious<UnionToTuple<T>>, 
	GetLastOrPrevious<UnionToTuple<U>>,
	GetLastOrPrevious<UnionToTuple<V>>, 
	GetLastOrPrevious<UnionToTuple<W>>
]>

type Entrypoint<S extends string = GenericPath<string,string,string,string>> = Record<
	S, 
	(args: S extends GenericPath<infer T, infer U, infer V, infer W> ? CombinedParamsObject<T, U, V, W> : never)=>void>


// USAGE:
function exampleRouteMapping<const T extends Label, U extends Label, V extends Label, W extends Label>(x:GenericPath<T, U, V, W>): CombinedParamsObject<T,U,V,W> {
	return [] as any
}

const exampleParamObject = exampleRouteMapping('/xyx/lol/d/:paramA/:bb/:paramC/');
exampleParamObject.paramA
exampleParamObject.bb
exampleParamObject.paramC
exampleParamObject.invalidParam