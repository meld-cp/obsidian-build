import { MessageModal } from "./modal-message";
import { TAssertRunContext } from "./run-context";

export class AssertImplemention implements TAssertRunContext {

	private async showFailMessage( label:string, msg:string ) : Promise<void>{
		const title = '❗ Assert Failed' + ( label.length > 0 ? ` - ${label}` : '' );
		const m = new MessageModal(app);
		await m.execute( title, msg );
	}

	public async isDefined( value:any, label?:string  ) : Promise<void> {
		if ( value != undefined && value != null ){
			return;
		}
		const msg = `Value is not defined`;
		this.showFailMessage( label ?? '', msg );
		throw new Error(msg);
	}
	
	public async isTrue( value:any, label?:string  ) : Promise<void> {
		if ( value ){
			return;
		}
		const msg = `Value was expected to be truthy`;
		this.showFailMessage( label ?? '', msg );
		throw new Error(msg);
	}

	public async isFalse( value:any, label?:string  ) : Promise<void> {
		if ( !value ){
			return;
		}
		const msg = `Value was expected to be falsy`;
		this.showFailMessage( label ?? '', msg );
		throw new Error(msg);
	}

	public async eq( expected:any, actual:any, label?:string ) : Promise<void> {
		if ( expected == actual ){
			return;
		}
		const msg = `Expected: '${expected}' but got '${actual}'`;
		this.showFailMessage( label ?? '', msg );
		throw new Error(msg);
	}

	public async neq( expected:any, actual:any, label?:string ) : Promise<void> {
		if ( expected != actual ){
			return;
		}
		const msg = `Values are equal`;
		this.showFailMessage( label ?? '', msg );
		throw new Error(msg);
	}

}
