import { App, Modal } from "obsidian";
import { Utils } from "utils";

export class MessageModal extends Modal {

	private message:string;
	private closed = true;

	constructor(app: App) {
		super(app);
	}
	
	public async execute( message:string ) : Promise<void>{
		
		this.message = message;
		this.closed = false;
		
		this.open();
		
		while(!this.closed){
			await Utils.delay(250);
		}
		
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText(this.message);
	}
  
	onClose() {
		const { contentEl } = this;
		contentEl.empty();
		this.closed = true;
	}
  }