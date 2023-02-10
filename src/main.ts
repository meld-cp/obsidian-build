import { MarkdownFileInfo, MarkdownPostProcessorContext, MarkdownView, moment, Notice, Plugin } from 'obsidian';
import * as HB from  'handlebars';
import { RunLogger } from 'src/run-logger';
import { Compiler } from 'src/compiler';
import { CODE_BLOCK_LANG_TOOLBAR, URL_HELP } from 'src/constants';
import { ToolbarButton } from './ToolbarButton';

export default class MeldBuildPlugin extends Plugin {

	private async codeblockProcessor(el: HTMLElement, ctx: MarkdownPostProcessorContext): Promise<void> {
		const els = el.querySelector('.language-js');
		
		if ( els == null ){
			return;
		}

		if ( els.getText().contains( '//@hide_when_reading' ) ){
			//console.debug('Hiding element',{el});
			el.hide();
		}
	}

	async onload() {
		
		await this.reloadActiveViewsWithToolbars();

		this.registerHandlebarHelpers();

		this.registerMarkdownCodeBlockProcessor(
			CODE_BLOCK_LANG_TOOLBAR,
			( source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext ) => this.processToolbarRender( source, el, ctx )
		);

		this.registerMarkdownPostProcessor( this.codeblockProcessor );

		this.addCommand({
			id: 'run',
			name: 'Run',
			editorCallback: async (editor, view) => await this.buildAndRun( view )
		});

		this.addCommand({
			id: 'help',
			name: 'Open help',
			callback: () => this.openHelp()
		});


	}

	private processToolbarRender(
		source: string,
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext
	){
		const buttons : ToolbarButton[] = [];

		const lines = source.split( '\n' );
		lines.forEach( line => {
			const button = ToolbarButton.parse(line);
			if (!button){
				return;
			}
			buttons.push(button);
		} );

		if ( buttons.length == 0 ){
			// add default buttons
			buttons.push(
				new ToolbarButton( 'run' ),
				new ToolbarButton( 'help' )
			);
		}

		// render buttons
		for (const button of buttons) {

			if ( button.id == 'run' ){
				el.createEl('button', { text: button.label ?? 'Run ▶️' }, el => {
					el.on('click', '*', async ev => await this.buildAndRunActiveView( button.params.first() ) );
				});
				continue;
			}
	
			if ( button.id == 'help' ){
				el.createEl('button', {text: button.label ?? '❔', title: 'Help' }, el=>{
					el.on( 'click', '*', ev => this.openHelp() );
				} );
				continue;
			}	
		}
	}

	private openHelp(){
		window.open(URL_HELP);
	}

	private async reloadActiveViewsWithToolbars(){
		this.app.workspace.iterateAllLeaves( leaf =>{
			const view = leaf.view;
			if ( view instanceof MarkdownView ){
				
				if (!view.editor.getValue().contains(CODE_BLOCK_LANG_TOOLBAR)){
					return;
				}
		
				//console.debug( `Meld-Build::Rebuilding view for file '${view.file.path}'` );
		
				(view.leaf as any).rebuildView();		
			}
		});
	}

	private async buildAndRunActiveView( runGroupTag?:string ){
		const view = this.app.workspace.getActiveViewOfType( MarkdownView );
		if (!view){
			new Notice( 'Unable to run, no active Markdown View found' );
			return;
		}
		await this.buildAndRun( view, runGroupTag );
	}

	private async buildAndRun( view: MarkdownView | MarkdownFileInfo, runGroupTag?:string ){
		if ( !( view instanceof MarkdownView ) ){
			return;
		}
		const logger = new RunLogger( view.app.vault );
		try{
			//await view.save();
			const compiler = new Compiler();
			const runner = await compiler.compile( logger, view, runGroupTag );
			runner?.();
		}catch(e){
			await logger.error(e);
			new Notice(e);
		}
	}

	private registerHandlebarHelpers(){
		// register handlebar helpers
		HB.registerHelper('format_number', function (value, options) {
			// Helper parameters
			const dp:number = parseInt( options.hash['decimal_places'] )
				|| parseInt( options.hash['dp'] )
				|| 2
			;
		
			// Parse to float
			const num = parseFloat(value);
		
			// Returns the formatted number
			return num.toFixed(dp);
		});
		
		HB.registerHelper('format_date', function (value, options) {
			// Helper parameters
			const pattern:string = options.hash['pattern'] as string || 'yyyy-MM-dd';
		
			// Returns the formatted date
			return moment(value).format(pattern);
		});

	}

}


