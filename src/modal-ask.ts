import { App, Modal, Setting } from "obsidian";

export class AskModal extends Modal {

	private question:string;
	private options:string[] = [];
	private answerInput:Setting;
	public answer:string|undefined;

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

		await new Promise<void>((resolve) => {
			
			this.open();

			this.onClose = () => {
				this.contentEl.empty();
				resolve();
			}
		});
		
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
							this.answer = answer ?? '';
							this.close();
						}
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
						this.answer = answer ?? '';
						this.close();
					})
				;
			})
		;
	}

  }