import { App, Modal } from "obsidian";
import { Utils } from "src/utils";

export class MessageModal extends Modal {

	private message:string;
	private closed = true;

	constructor(app: App) {
		super(app);
	}
	
	public async execute(
		title:string,
		message:string
	) : Promise<void>{
		
		this.titleEl.setText( title );
		
		this.message = message;
		this.closed = false;
		
		this.open();
		
		while(!this.closed){
			await Utils.delay(250);
		}
		
	}

	onOpen() {
		const { contentEl } = this;
		const formattedLines = this.message.split('\n').join('<br/>');
		contentEl.innerHTML = formattedLines;
	}
  
	onClose() {
		const { contentEl } = this;
		contentEl.empty();
		this.closed = true;
	}
  }