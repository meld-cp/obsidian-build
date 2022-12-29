import { CachedMetadata, Editor, MarkdownView, moment, normalizePath, Notice, Plugin, TFile } from 'obsidian';
import {DataviewApi, getAPI as dvGetAPI} from "obsidian-dataview";
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
	return moment(value).format(pattern);
});

HB.registerHelper('data_uri', function (value, options) {
	//TODO
    // Helper parameters
    //const file = options.hash['file'] as string;
	//const contentType = options.hash['content_type'] as string;

	// check if file exists
	// convert file to data uri
	
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
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				try{
					await view.save();
					const b = new Compiler();
					const runner = b.compile(editor, view);
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
	// is this needed?
	//columns: Array<string> = [];
}

interface IDataSetCollection {
	[name:string] : DataSet;
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

interface IContext {
	data: IDataSetCollection;
	templates: ITemplateContent[];

	//current: MarkdownView;

	//comp: Component;
	//log: (...data: unknown[]) => void;
	log: (message?: any, ...optionalParams: any[]) => void;
	log_error: (message?: any, ...optionalParams: any[]) => void;

	notice: (message: string | DocumentFragment, timeout?: number) => void;

	render: (cb :ITemplateContent, data:object) => string;
	output: ( file:string, content:string, open?:boolean ) => void;
	open: (linkText:string) => void;
	load_data: (filepath:string, name?:string) => Promise<DataSet>;
	load_template: (filepath:string) => Promise<ITemplateContent>;
	import: (filepath:string) => void;

	rebuild_view: () => void;

	dv: DataviewApi | undefined;
	//dataview: DataviewApi | undefined;
}

interface ITemplateContent{
	languages:string[];
	content:string;
}

// interface ITemplateBuilder{
// 	build: () => string;
// }

class Parser {

	public applyMarkdownContent( name:string, content:string, data:IDataSetCollection, templates:ITemplateContent[] ) : void {
		const lines = content.split('\n').map( e=>e.trim().trim());
		//console.debug(lines);

		let currentHeader = '';
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			if (line.startsWith('#')){
				// header
				currentHeader = this.extractHeader(line);
			}else if (line.startsWith('|')){
				// extract table
				const tableLines: string[] = [];
				while( i < lines.length && lines[i].startsWith('|') ){
					const tableLine = lines[i];
					tableLines.push(tableLine);
					i++;
				}
				const dataPropName = this.convertToTableName( currentHeader.length > 0 ? currentHeader : name );
				data[dataPropName] = this.parseAsMdTable(tableLines);
			}else if ( line.startsWith('```html') ){
				const templateLines: string[] = [];
				i++;
				while( i < lines.length && !lines[i].startsWith('```') ){
					const templateLine = lines[i];
					templateLines.push(templateLine);
					i++;
				}
				templates.push( {content : templateLines.join('\n'), languages: ['html']} );
			}
		}
	}

	private extractHeader(line:string) : string{
		//todo
		return this.convertToTableName(line.replace('#',''));
	}

	private parseAsMdTable( tableLines:string[] ): DataSet {
		const data: DataSet = new DataSet();
		
		const tlines = tableLines
		.map( e=>e.trim().slice(1,-1).trim());

		//console.debug(tableLines);
		const columns = tlines
			.first()?.split('|')
			.map( e=> this.convertToColumnName(e) )
			.filter( e=>e.length > 0)
			?? []
		;

		for (let i = 1; i < tlines.length; i++) {
			const rowLine = tlines[i];
			//console.debug(line);
			if (rowLine.startsWith('---') ){
				continue;
			}
			if (rowLine.startsWith('|') && rowLine.endsWith('|')){
				continue;
			}
			const rowValues : unknown[] = rowLine.split('|').map( e => this.covertFromString(e) );
			data.push( new DataSetRow( columns, rowValues ) );
		}

		return data;
	}

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
				const tableLines = table.split('\n');
				const data = this.parseAsMdTable(tableLines);

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
	): ITemplateContent[] {
		const result: ITemplateContent[] = [];
		
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
	
	public loadCsv( csvdata:string ) : DataSet {
		const lines = csvdata.split('\n').map( e=>e.trim());
		if (lines.length == 0){
			return new DataSet();
		}
		//console.debug(lines);
		const columns = lines.first()?.split(',').map( e=> this.convertToColumnName(e) ) ?? [];
		
		const rows = new Array<DataSetRow>();

		for (let i = 1; i < lines.length; i++) {
			const rowData = lines[i].split(',').map( d=>this.covertFromString(d));
			rows.push( new DataSetRow(columns, rowData));
		}

		const ds = new DataSet( ...rows );
		//ds.columns = columns;
		return ds;
	}
}



export class Compiler{

	public compile(editor: Editor, view: MarkdownView) : () => void {

		const fileCache = app.metadataCache.getFileCache(view.file);

		if (fileCache == null){
			return async () => {};
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
		const dataViewApi = dvGetAPI();
		//const comp = new Component();
		//ma
		//comp.addChild
		const context : IContext = {
			data: data,
			templates: templateBlocks,

			//current: view,
			//comp: ,

			load_data: (filepath, name) => this.data_loader(data, filepath, name),
			load_template: (filepath) => this.template_loader(templateBlocks, filepath),
			import: (filepath) => this.import( data, templateBlocks, filepath),
			
			log: x => window.console.info( 'meld-build', x ),
			log_error: x => window.console.error( 'meld-build', x ),
			notice: (msg, timeout) => new Notice(msg, timeout),
			
			dv: dataViewApi,
			//dataview: dataViewApi,

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
				const outputFilename = normalizePath(filename)
					.replace('..', '_')
				;
				//const outputFilename = normalizePath( `${activeFile.basename} ${sanFilename}` );

				const newFilepath = normalizePath( activeFile.parent.path + "/" + outputFilename );
				//console.debug({outputFilename,newFilepath});
				const af = app.vault.getAbstractFileByPath(newFilepath);
				if (af instanceof TFile){
					await app.vault.trash(af, false);
				}

				await app.vault.create( newFilepath, content );
				
				
			
				new Notice(`${newFilepath} created`);
				if (open == true){
					await app.workspace.openLinkText( newFilepath, '' );
				}
			},

			open: (linktext:string) => app.workspace.openLinkText( linktext, '' ),

			rebuild_view: async () => await (view.leaf as any).rebuildView(),

		};

		// return runner
		return () => this.buildSandboxedRunnerFunction(sourceCode, context);
		//return () => this.buildRunnerFunction(sourceCode, context);
	}

	private getAbsoluteFilepathFromActiveFile( path:string ) : string | undefined {
		const activeFile = app.workspace.getActiveFile();
		if (activeFile == null){
			return;
		}
		return normalizePath( activeFile.parent.path + "/" + path );
	}

	private async data_loader(data: IDataSetCollection, filepath:string, name?:string) : Promise<DataSet>{
		let resultDataSet = new DataSet();

		const absFilepath = this.getAbsoluteFilepathFromActiveFile(filepath);
		if (!absFilepath){
			return resultDataSet;
		}

		//console.debug({filepath, name, absFilepath});
		const file = app.vault.getAbstractFileByPath(absFilepath);
		//console.debug({file});
		const pzr = new Parser();
		if (file instanceof TFile){
			if (file.extension == 'csv'){
				const csvdata = await app.vault.read( file );
				resultDataSet = pzr.loadCsv(csvdata);
				data[name??file.basename] = resultDataSet;
			}
		}
		
		//console.log('loaded');
		return resultDataSet;
	}

	private async template_loader(templates: ITemplateContent[], filepath:string) : Promise<ITemplateContent>{
		const resultContent : ITemplateContent = { content : '', languages: [] };

		const absFilepath = this.getAbsoluteFilepathFromActiveFile(filepath);
		if (!absFilepath){
			return resultContent;
		}
		const file = app.vault.getAbstractFileByPath(absFilepath);
		if (file instanceof TFile){
			resultContent.content = await app.vault.read( file );
			resultContent.languages = [file.extension];
			templates.push(resultContent);
		}
		

		return resultContent;
	}

	private async import(data: IDataSetCollection, templates: ITemplateContent[], filepath:string) : Promise<void>{
		//const resultContent : ITemplateContent = { content : '', languages: [] };

		const absFilepath = this.getAbsoluteFilepathFromActiveFile(filepath);
		if (!absFilepath){
			return;
		}
		const file = app.vault.getAbstractFileByPath(absFilepath);
		if (file instanceof TFile){
			if (file.extension == 'md'){
				const content = await app.vault.read( file );
				const pzr = new Parser();
				pzr.applyMarkdownContent( file.basename, content, data, templates);
				// // copy to passed in data collection
				// Object.keys(fileDatasets).forEach(key => {
				// 	data[key] = fileDatasets[key];
				// });
				// resultContent.languages = [file.extension];
				// templates.push(resultContent);
			}
		}
		
	}

	// private template_loader(filepath:string) : ICodeBlock{

	// }

	// pathJoin(dir: string, subpath: string): string {
	// 	const result = path.join(dir, subpath);
	// 	// it seems that obsidian do not understand paths with backslashes in Windows, so turn them into forward slashes
	// 	return normalizePath(result.replace(/\\/g, '/'));
	// }
	
	private buildRunnerFunction(code:string, context:IContext) : FunctionConstructor {
		//const frame = document.createElement('iframe');
		//document.body.appendChild(frame);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		//const f = window.Function;
		//document.body.removeChild(frame);
		
		
		// const restrictedKeys = [
		// 	...Object.keys(frame.contentWindow??{}),
		// 	'self',
		// 	'document',
		// 	'console'
		// ];
		//const undefineds = restrictedKeys.map( v=>undefined );

		const errFrag = new DocumentFragment();
		errFrag.appendText('RUNTIME ERROR\n');
		//errFrag.c
		//errFrag.appendText('RUNTIME ERROR\n');

		const additionals = {
			'errFrag': errFrag
		};

		return window.Function(
			//...restrictedKeys,
			...Object.keys(additionals),
			'$',
			//"'use strict';" + code
			code
		)(
			//...undefineds,
			...Object.values(additionals),
			context
		);

	}

	private buildSandboxedRunnerFunction(code:string, context:IContext) : FunctionConstructor {
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
		const undefineds = restrictedKeys.map( v=>undefined );

		const errFrag = new DocumentFragment();
		errFrag.appendText('RUNTIME ERROR\n');
		//errFrag.c
		//errFrag.appendText('RUNTIME ERROR\n');

		const additionals = {
			'errFrag': errFrag
		};

		return f(
			...restrictedKeys,
			...Object.keys(additionals),
			'$',
			//"'use strict';" + code
			`
			'use strict';
			( async () => {
				$.log('Run Start');
				${code}
			} )()
				.catch( (e) => {
					$.log_error(e);
					errFrag.appendText(e);
					$.notice(errFrag);
				})
				.finally( () => {
					$.log('Run End');
				})
			;
			`
		)(
			...undefineds,
			...Object.values(additionals),
			context
		);

		// return f(
		// 	...restrictedKeys,
		// 	'$',
		// 	//"'use strict';" + code
		// 	`
		// 	'use strict';
		// 	$.log('Start');
		// 	Promise
		// 		.resolve(
		// 			( async () => {
		// 				${code}
		// 			} )()
		// 		)
		// 		.catch( (e) => {
		// 			$.log(e);
		// 		})
		// 	;
		// 	$.log('End');
		// 	`
		// )(
		// 	...undefineds,
		// 	context
		// );
	}
	


}