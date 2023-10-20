export interface AppPlugin<Data = unknown> {
	name: string
	apply(data:Data): Promise<void>|void
}
