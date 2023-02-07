import { Datex, sync, property, scope, timeout, f} from "unyt_core";
import {UIX} from "../../uix.ts";
import {Terminal, TERMINAL_OPTIONS} from "./main.ts"

@sync("ext:RemoteShell") @scope("shell") class _RemoteShell {

    @scope @timeout(60_000) static newSession(): Datex.Return<_RemoteShell> {}
    @property out_stream!: Datex.Stream<ArrayBuffer>;
    @property in_stream!: Datex.Stream<ArrayBuffer>;
    @property width!: number;
    @property height!: number;
	@property winch() {}

}


@UIX.Component({responsive:true})
@UIX.NoResources
export class RemoteTerminal extends Terminal<TERMINAL_OPTIONS & {endpoint:Datex.Endpoint}> {

    @property shell!: _RemoteShell

    protected override async onConstruct() {
        await super.onConstruct()
        await this.initConnection();
    }

    private async initConnection() {
        console.log("endpoint: " + this.options.endpoint);
        this.shell = <_RemoteShell> await RemoteShell.to(this.options.endpoint).newSession();
        console.log("shell",this.shell)
        // connect out/in stream
        this.out_stream = this.options.out = this.shell.in_stream;
        this.in_stream = this.options.in = this.shell.out_stream;

        // update terminal dimensions
        this.onResize();
    }
    
    protected override onResize(): void {
        if (!this.shell) return;
        // updates dimensions in the actual terminal device
        this.shell.width = this.current_width;
        this.shell.height = this.current_height;
    }
}


export const RemoteShell = Datex.datex_advanced(_RemoteShell);