import { App, Modal } from "obsidian";

export class MessageModal extends Modal {

	private message:string;

	constructor( app: App ) {
		super( app );
	}
	
	public async execute(
		title:string,
		message:string
	) : Promise<void>{
		
		this.titleEl.setText( title );
		
		this.contentEl.append( ...MessageModal.buildContent( message ) );
		
		await new Promise<void>((resolve) => {
			this.open();
			this.onClose = () => {
				this.contentEl.empty();
				resolve();
			}
		});

	}

	private static buildContent( message: string ) : Node[] {

		const result = Array<Node>();

		const lines = message.split( '\n' );

		lines.forEach( line => {
			result.push( createDiv( { text: line } ) );
		} );

		return result;
	}

  }