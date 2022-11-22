import { CachedMetadata, Editor, MarkdownView, Notice, Plugin, TFile } from 'obsidian';

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: 'default'
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'meld-build-run',
			name: 'Run',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				//editor.replaceSelection('Sample Editor Command');
				const b = new Builder();
				b.compile(editor, view.file);
				b.run();
			}
		});

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

class DataSet{
	name: string;
	columns: string[] = [];
	rows: string[][] = [];
}

interface ICompiled{
	name: string;
	codeBlocks: string[];
	data: DataSet[]
}

export class Builder{
	
	private compiled : ICompiled;

	compile(editor: Editor, file: TFile) {
		const fileCache = app.metadataCache.getFileCache(file);
		console.log({fileCache});
		this.compiled = {
			name: file.basename,
			codeBlocks: fileCache ? this.fetchCodeBlocks(editor, fileCache) : [],
			data: fileCache ? this.fetchData(editor, fileCache) : [],
		};
	}

	private fetchData(editor: Editor, fileCache: CachedMetadata): DataSet[] {
		const result: DataSet[] = [];
		if (!fileCache.sections){
			return result;
		}

		let headingIdx = -1;
		let lastHeading = '';
		for (let i = 0; i < fileCache.sections.length; i++) {
			const section = fileCache.sections[i];
			if (section.type == 'heading' ){
				headingIdx++;
				lastHeading = fileCache.headings?.at(headingIdx)?.heading ?? '?';
				console.debug({lastHeading});
			} 
			if (section.type == 'table' ){

				const from = editor.offsetToPos(section.position.start.offset);
				const to = editor.offsetToPos(section.position.end.offset);
				const table = editor.getRange( from, to );

				
				const data: DataSet = new DataSet();
				data.name = lastHeading;
				
				const tableLines = table.split('\n').map( e=>e.trim().slice(1,-1).trim());
				console.debug(tableLines);
				data.columns = tableLines.first()?.split('|').map( e=>e.trim()) ?? [];
				for (let i = 1; i < tableLines.length; i++) {
					const line = tableLines[i];
					if (line.startsWith('---') ){
						continue;
					}
					if (line.startsWith('|') && line.endsWith('|')){
						continue;
					}
					const row = line.split('|').map( e=>e.trim());
					data.rows.push(row);
				}

				result.push( data );
				
			}
		}

		return result;
	}

	private fetchCodeBlocks(editor: Editor, cache: CachedMetadata): string[] {
		const result: string[] = [];
		cache.sections?.forEach(section => {
			if (section.type != 'code'){
				return;
			}
			const from = editor.offsetToPos(section.position.start.offset);
			const to = editor.offsetToPos(section.position.end.offset);
			const code = editor.getRange( from, to );
			let lines = code.split('\n');
			if (lines.length <= 2){
				return;
			}
			if ( !['```js', '```javascript'].find( e=> e.startsWith( lines[0].toLowerCase() ) )){
				return;
			}
			// remove first and last lines
			lines = lines.slice(1,-1)
			result.push(...lines);
		});
		return result;
	}
	
	private fetchHelperCode(): string{
		// const result:unknown = {};
		// result.log = (o) => console.log(o);
		let result = `
const $={};
$.log = console.log;
`
		;

// 		//Sum.. not needed
// 		result += `
// $.sum = function() {
// 	return [...arguments].reduce( (c,p) => parseFloat(c) + parseFloat(p), 0.0 )
// }
// `

		// load data sets
		result += `$.data = {\n`;
		//${JSON.stringify(d)}
		this.compiled.data.forEach(d => {
			const dataSetName = JSON.stringify(d.name.toLowerCase().replace(' ', '_').trim());
			result += `  ${dataSetName} : [\n`
			for (let i = 0; i < d.rows.length; i++) {
				const r = d.rows[i];
				result += '    {';
				for (let j = 0; j < d.columns.length; j++) {
					const c = d.columns[j];
					const valAsNum = parseFloat(r[j]); 
					const value = isNaN(valAsNum) ? JSON.stringify(r[j]) : valAsNum;
					result += `'${c}':${value},`
				}
				result += '},\n';
			}
			result += `  ],\n`
		});
		result += `}\n`;

		// return
		return result;
	}

	run() {
		console.debug(this.compiled);
		
		const scopedCode = this.fetchHelperCode() + this.compiled.codeBlocks.join('\n');
		console.log(scopedCode);
		try{
			eval(scopedCode);
		}catch(e){
			console.error(e);
			new Notice(e);
		}
	}


}

// class SampleModal extends Modal {
// 	constructor(app: App) {
// 		super(app);
// 	}

// 	onOpen() {
// 		const {contentEl} = this;
// 		contentEl.setText('Woah!');
// 	}

// 	onClose() {
// 		const {contentEl} = this;
// 		contentEl.empty();
// 	}
// }

// class SampleSettingTab extends PluginSettingTab {
// 	plugin: MyPlugin;

// 	constructor(app: App, plugin: MyPlugin) {
// 		super(app, plugin);
// 		this.plugin = plugin;
// 	}

// 	display(): void {
// 		const {containerEl} = this;

// 		containerEl.empty();

// 		containerEl.createEl('h2', {text: 'Settings for my awesome plugin.'});

// 		new Setting(containerEl)
// 			.setName('Setting #1')
// 			.setDesc('It\'s a secret')
// 			.addText(text => text
// 				.setPlaceholder('Enter your secret')
// 				.setValue(this.plugin.settings.mySetting)
// 				.onChange(async (value) => {
// 					console.log('Secret: ' + value);
// 					this.plugin.settings.mySetting = value;
// 					await this.plugin.saveSettings();
// 				}));
// 	}
// }
