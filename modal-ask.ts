import { App, Modal, Setting } from "obsidian";
import { Utils } from "utils";

export class AskModal extends Modal {

	private question:string;
	private options:string[] = [];
	private sOptions:Setting;
	public answer:string;
	private closed = true;

	constructor(app: App) {
		super(app);
	}

	public async execute( question:string, options?:string[] ) : Promise<string|undefined>{
		
		this.question = question;
		this.options = options ?? [];

		this.closed = false;
		
		this.open();
		
		while(!this.closed){
			await Utils.delay(250);
		}

		return Promise.resolve( undefined );
	}

	override onOpen() {
		const { contentEl } = this;
		contentEl.setText( this.question );
		if ( this.options.length > 0 ){
			this.sOptions = new Setting(contentEl);
			this.sOptions.addDropdown( cb=>{
				this.options.forEach( o => {
					cb.addOption( o, o ).onChange((v)=>this.answer = v);
				})
			} );
		}
	}
  
	override onClose() {
		const { contentEl } = this;
		this.closed = true;
		contentEl.empty();
	}
  }