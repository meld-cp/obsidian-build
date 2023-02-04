import { App, Modal } from "obsidian";

export class MessageModal extends Modal {

	private message:string;

	constructor(app: App) {
		super(app);
	}
	
	public async execute(
		title:string,
		message:string
	) : Promise<void>{
		
		this.titleEl.setText( title );
		
		this.message = message;
		
		await new Promise<void>((resolve) => {
			
			this.open();

			this.onClose = () => {
				this.contentEl.empty();
				resolve();
			}
		});

	}

	onOpen() {
		const { contentEl } = this;
		const formattedLines = this.message.split('\n').join('<br/>');
		contentEl.innerHTML = formattedLines;
	}

  }