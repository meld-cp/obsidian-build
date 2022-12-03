import { CachedMetadata, Editor, MarkdownView, moment, normalizePath, Notice, Plugin, TFile } from 'obsidian';
//import * as Mustache from 'mustache';
//import {render as mustacheRender} from 'mustache';

//const  = ( (MustacheNs as any).default as MustacheNs);
// TODO Remember to rename these classes and interfaces!
//import Mustache = require('mustache');
//import * as MustacheNs from 'mustache'
//import {render} from 'mustache'
import * as HB from  'handlebars';
//import path from 'path';

HB.registerHelper('format_number', function (value, options) {
    // Helper parameters
    const dp = parseInt( options.hash['decimal_places'] ) || 2;

	// Parse to float
    value = parseFloat(value);

    // Returns the formatted number
    return value.toFixed(dp);
});

HB.registerHelper('format_date', function (value, options) {
    // Helper parameters
    const pattern = options.hash['pattern'] as string || 'yyyy-MM-dd';

	// Returns the formatted date
	const m = moment(value);
	return m.format(pattern);
});


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

		// try {
		// 	this.registerExtensions(['html'], 'meld-build-html-view');
		// } catch (error) {
		// 	new Notice(error);
		// 	//await showError(`File extensions ${HTML_FILE_EXTENSIONS} had been registered by other plugin!`);
		// }

		this.addCommand({
			id: 'meld-build-run',
			name: 'Run',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				try{
					const b = new Compiler();
					const runner = b.compile(editor, view.file);
					runner();
				}catch(e){
					console.error(e);
					new Notice(e);
				}
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

class DataSet extends Array<DataSetRow> {
	columns: Array<string> = [];
}

interface IDataSetCollection {
	[name:string] : DataSet
}

interface IRowDataValueCollection {
	[column:string | number] : unknown
}

class DataSetRow implements IRowDataValueCollection{
	
	[column: string]: unknown;

	constructor(columnNames:string[], data: unknown[]){
		for (let colIdx = 0; colIdx < columnNames.length; colIdx++) {
			const value = data.at(colIdx);
			const colName = columnNames[colIdx].trim();
			if ( colName != '' ){
				this[colName] = value;
			}
		}
	}

}

interface IContext{
	data: IDataSetCollection;
	templates: ICodeBlock[];
	log: (...data: unknown[]) => void;
	render: (cb :ICodeBlock, data:object) => string;
	output: ( file:string, content:string, open:boolean ) => void;
	open: (linkText:string) => void;
}

interface ICodeBlock{
	languages:string[];
	content:string;
}

// interface ITemplateBuilder{
// 	build: () => string;
// }

class Parser {

	public fetchData(editor: Editor, fileCache: CachedMetadata | undefined): IDataSetCollection {
		const result:{
			[index:string] : DataSet
		} = {};
		
		if ( fileCache == undefined){
			return result;
		}


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
				//console.debug({lastHeading});
			} 
			if (section.type == 'table' ){

				const from = editor.offsetToPos(section.position.start.offset);
				const to = editor.offsetToPos(section.position.end.offset);
				const table = editor.getRange( from, to );

				
				const data: DataSet = new DataSet();
				
				const tableLines = table.split('\n').map( e=>e.trim().slice(1,-1).trim());
				//console.debug(tableLines);
				data.columns = tableLines
					.first()?.split('|')
					.map( e=> this.convertToColumnName(e) )
					.filter( e=>e.length > 0)
					?? []
				;

				for (let i = 1; i < tableLines.length; i++) {
					const rowLine = tableLines[i];
					//console.debug(line);
					if (rowLine.startsWith('---') ){
						continue;
					}
					if (rowLine.startsWith('|') && rowLine.endsWith('|')){
						continue;
					}
					const rowValues : unknown[] = rowLine.split('|').map( e => this.covertFromString(e) );
					data.push( new DataSetRow( data.columns, rowValues ) );
				}
				
				const tableName = this.convertToTableName(lastHeading);
				result[tableName] = data;
				//result.push( data );
				
			}
		}

		return result;
	}

	private looksLikeDate( str:string ): boolean {
		/**
		 * RegExps to test a string for a str starting with
		 *  YYYY-MM-DD or YYYY-MM
		 */
		const rxY4M2D2 = /^[12]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])/;
		const rxY4M2 = /^[12]\d{3}-(0[1-9]|1[0-2])/;
		return rxY4M2D2.test(str) || rxY4M2.test(str);

	}

	private looksNumber( str:string ): boolean {
		/**
		* RegExps to test a string for a str starting with
		*  -1234
		*  123
		*  12.3456
		*  12.1
		*  0.1
		*  - 12
		*  0
		*/
		const rxNumber = /^-?\s*(\d*)\.?(\d*)$/;
		return rxNumber.test(str);

	}

	private convertToTableName( str:string ) : string {
		return str.trim().replace(/\W/ig, '_').toLowerCase();
	}

	private convertToColumnName( str:string ) : string {
		return str.trim().replace(/\W/ig, '_').toLowerCase();
	}
	
	private covertFromString( str:string ) : string | number | Date {
		const trimmed = str.trim();
		//console.debug({trimmed});
		//see: https://rgxdb.com/r/526K7G5W
		
		if ( this.looksLikeDate(trimmed) ){
			const dp = Date.parse(trimmed);
			if (!isNaN(dp)){
				//const dt = new Date(dp);
				return new Date(dp);
			}
		}

		if ( this.looksNumber(trimmed) ){
		const flt = parseFloat( trimmed );
			if ( !isNaN(flt) ){
				return flt;
			}
		}

		return trimmed;
	}

	public fetchCodeBlocks(
		editor: Editor,
		fileCache: CachedMetadata | undefined,
		languages :string[]
	): ICodeBlock[] {
		const result: ICodeBlock[] = [];
		
		if ( fileCache == undefined){
			return result;
		}

		if ( fileCache.sections == undefined ){
			return result;
		}
		
		fileCache.sections.forEach(section => {
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
			const lineStarts = languages.map( l=> '```'+l );
			if ( !lineStarts.find( e=> e.startsWith( lines[0].toLowerCase() ) )){
				return;
			}
			// remove first and last lines
			lines = lines.slice(1,-1)
			result.push( { languages, content: lines.join('\n') } );
		});

		return result;
	}

}

export class Compiler{

	public compile(editor: Editor, file: TFile) : () => void {
		const fileCache = app.metadataCache.getFileCache(file);

		if (fileCache == null){
			return () => {};
		}

		const pzr = new Parser();
		
		// data
		const data = pzr.fetchData(editor, fileCache);

		// code
		const codeBlocks = pzr.fetchCodeBlocks(editor, fileCache, ['js', 'javascript']);
		const sourceCode = codeBlocks.map( cb => cb.content).join('\n');

		// templates
		const templateBlocks = pzr.fetchCodeBlocks(editor, fileCache, ['html']);

		// build context
		const context : IContext = {
			data: data,
			templates: templateBlocks,
			log: x => window.console.info( 'meld-build', x ),
			render: (cb, data) =>{
				const template = HB.compile( cb.content );
				const result = template(data);
				return result;
			},
			output: async (filename, content, open) =>{
				
				const activeFile = app.workspace.getActiveFile();
				
				//letoutputFile = normalizePath( newFileFolder.path + "/" + filename )
				if (activeFile == null){
					return;
				}

				//console.debug( app.vault.getAbstractFileByPath(filename) );
				const sanFilename = normalizePath(filename)
					.replace('/', '_')
					.replace('..', '_')
				;
				const outputFilename = normalizePath( `${activeFile.basename} ${sanFilename}` );

				const newFilepath = normalizePath( activeFile.parent.path + "/" + outputFilename );
				//console.debug({outputFilename,newFilepath});
				const af = app.vault.getAbstractFileByPath(newFilepath);
				if (af instanceof TFile){
					await app.vault.trash(af, false);
				}

				await app.vault.create( newFilepath, content );
			
				new Notice(`${newFilepath} created`);
				if (open){
					await app.workspace.openLinkText( newFilepath, '' );
				}
			},
			open: (linktext:string) => app.workspace.openLinkText( linktext, '' )

		};

		// return runner
		return () => this.sandboxed(sourceCode, context);
	}

	// pathJoin(dir: string, subpath: string): string {
	// 	const result = path.join(dir, subpath);
	// 	// it seems that obsidian do not understand paths with backslashes in Windows, so turn them into forward slashes
	// 	return normalizePath(result.replace(/\\/g, '/'));
	// }
	
	private sandboxed(code:string, context:IContext) : FunctionConstructor {
		const frame = document.createElement('iframe');
		document.body.appendChild(frame);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const f = (frame.contentWindow as any).Function as FunctionConstructor;
		document.body.removeChild(frame);
		
		
		const restrictedKeys = [
			...Object.keys(frame.contentWindow??{}),
			'self',
			'document',
			'console'
		];
		const undefineds = restrictedKeys.map( v=>undefined);

		return f(
			...restrictedKeys,
			'$',
			"'use strict';" + code
		)(
			...undefineds,
			context
		);
	}
	


}