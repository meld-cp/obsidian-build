import { App, Modal, Setting } from "obsidian";
import { Utils } from "utils";

export class AskModal extends Modal {

	private question:string;
	private options:string[] = [];
	private answerInput:Setting;
	public answer:string|undefined;
	private completed = true;
	//private cancelled = false;

	constructor(app: App) {
		super(app);
	}

	public async execute(
		title:string|undefined,
		question:string,
		options:string[],
	) : Promise<string|undefined>{
		
		this.titleEl.setText( `❓ ${title}`.trim() );

		this.question = question;
		this.answer = undefined;
		this.options = options ?? [];

		this.completed = false;
		
		this.open();
		
		while(!this.completed){
			await Utils.delay(250);
		}

		return this.answer;
	}

	override onOpen() {
		const { contentEl } = this;
		
		let answer:string|undefined = undefined;
		
		this.answerInput = new Setting(contentEl).setName( this.question );

		if ( this.options.length > 0 ){
			this.answerInput.addDropdown( cb=>{
				cb.addOption( '', '' ).onChange((v)=>answer = undefined);
				
				this.options.forEach( o => {
					cb.addOption( o, o ).onChange((v)=>answer = v);
				})
			} );
		}else{
			this.answerInput.addText( cb=>{
				cb
					.onChange( v=> answer = v )
					.inputEl.on('keypress','*', ev=>{
						if (ev.key == 'Enter'){
							ev.stopPropagation();
							ev.preventDefault();
							this.answer = answer;
							this.close();
						}
						//console.log(ev);
					})
				;
			});
		}

		// OK button
		new Setting(contentEl)
			.addButton(cb =>{
				cb
					.setButtonText('OK')
					.onClick( ev => {
						this.answer = answer;
						this.close();
					})
				;
			})
		;
	}
  
	override onClose() {
		const { contentEl } = this;
		this.completed = true;
		contentEl.empty();
	}
  }