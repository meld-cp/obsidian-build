import { Editor, MarkdownView, moment, Notice, Plugin } from 'obsidian';
import * as HB from  'handlebars';
import { RunLogger } from 'src/run-logger';
import { Compiler } from 'src/compiler';

interface MeldBuildPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MeldBuildPluginSettings = {
	mySetting: 'default'
}

const CODE_BLOCK_LANG_TOOLBAR = 'meld-build-toolbar';

export default class MeldBuildPlugin extends Plugin {
	settings: MeldBuildPluginSettings;


	async onload() {
		
		//console.debug((app as any).commands.commands);

		await this.loadSettings();

		await this.reloadActiveViewsWithToolbars();

		this.registerHandlebarHelpers();

		// this.registerMarkdownPostProcessor((element, context) => {
		// 	const toolbarElements = element.querySelectorAll('code.language-meld-build-toolbar');
		// 	toolbarElements.forEach(el => {
		// 		context.addChild()
		// 	});
		// });

		this.registerMarkdownCodeBlockProcessor( CODE_BLOCK_LANG_TOOLBAR, (source, el, ctx) => {
			const lines = source.split('\n');
			const valueMap = new Map<string,string>();
			lines.forEach(line => {
				const pair = line.split('=');
				if(pair.length == 2){
					valueMap.set(pair[0].trim(), pair[1].trim());
				}
			});

			const runButtonLabel = valueMap.get('run');
			const showRunButton = runButtonLabel !== '';

			const helpButtonLabel = valueMap.get('help');
			const showHelpButton = helpButtonLabel !== '';

			if (showRunButton){
				el.createEl('button', { text: runButtonLabel ?? 'Run'}, el => {
					el.on('click', '*', ev => this.buildAndRunActiveView() );
				});
			}

			if (showHelpButton){
				el.createEl('button', {text: helpButtonLabel ?? '❔', title: 'Help' }, el=>{
					el.on('click', '*', async ev=>{
						window.open('https://github.com/meld-cp/obsidian-build/blob/master/docs/user-guide.md');
					});
				} );
			}

		});


		this.addCommand({
			id: 'run',
			name: 'Run',
			editorCallback: this.buildAndRun
		});


	}

	private async reloadActiveViewsWithToolbars(){
		app.workspace.iterateAllLeaves( leaf =>{
			const view = leaf.view;
			if ( view instanceof MarkdownView ){
				
				if (!view.editor.getValue().contains(CODE_BLOCK_LANG_TOOLBAR)){
					return;
				}
		
				console.debug( `Meld-Build::Rebuilding view for file '${view.file.path}'` );
		
				(view.leaf as any).rebuildView();		
			}
		});
		//const view = app.workspace.getActiveViewOfType( MarkdownView );
		//if (view == null){
		//	return;
		//}

		
	}

	private async buildAndRunActiveView(){
		const view = app.workspace.getActiveViewOfType( MarkdownView );
		if (!view){
			return;
		}
		await this.buildAndRun( view.editor, view);
	}

	private async buildAndRun( editor:Editor, view: MarkdownView ){
		const logger = new RunLogger();
		try{
			//await view.save();
			const compiler = new Compiler();
			const runner = compiler.compile(logger, editor, view);
			runner();
		}catch(e){
			await logger.error(e);
			new Notice(e);
		}
	}

	private registerHandlebarHelpers(){
		// register handlebar helpers
		HB.registerHelper('format_number', function (value, options) {
			// Helper parameters
			const dp:number = parseInt( options.hash['decimal_places'] ) || parseInt( options.hash['dp'] ) || 2;
		
			// Parse to float
			value = parseFloat(value);
		
			// Returns the formatted number
			return value.toFixed(dp);
		});
		
		HB.registerHelper('format_date', function (value, options) {
			// Helper parameters
			const pattern:string = options.hash['pattern'] as string || 'yyyy-MM-dd';
		
			// Returns the formatted date
			return moment(value).format(pattern);
		});
		
		//HB.registerHelper('data_uri', function (value, options) {
			//TODO
			// Helper parameters
			//const file = options.hash['file'] as string;
			//const contentType = options.hash['content_type'] as string;
		
			// check if file exists
			// convert file to data uri
			
		//});

	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
