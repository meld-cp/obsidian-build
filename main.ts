import { CachedMetadata, Editor, MarkdownView, moment, normalizePath, Notice, Plugin, TFile } from 'obsidian';
import {DataviewApi, getAPI as dvGetAPI} from "obsidian-dataview";
import * as HB from  'handlebars';
import { MessageModal } from 'modal-message';
import { AskModal } from 'modal-ask';
import { Utils } from 'utils';

HB.registerHelper('format_number', function (value, options) {
    // Helper parameters
    const dp = parseInt( options.hash['decimal_places'] ) || parseInt( options.hash['dp'] ) || 2;

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

//HB.registerHelper('data_uri', function (value, options) {
	//TODO
    // Helper parameters
    //const file = options.hash['file'] as string;
	//const contentType = options.hash['content_type'] as string;

	// check if file exists
	// convert file to data uri
	
//});


interface MeldBuildPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MeldBuildPluginSettings = {
	mySetting: 'default'
}

export default class MeldBuildPlugin extends Plugin {
	settings: MeldBuildPluginSettings;

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
				const logger = new Logger();
				try{
					//await view.save();
					const compiler = new Compiler();
					const runner = compiler.compile(logger, editor, view);
					runner();
				}catch(e){
					logger.error(e)
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
	// TODO: is this needed?
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



type TRunContext = {

	sourceCode: string;

	data: IDataSetCollection;
	templates: string[];

	logger: Logger,
	log( ...params: any[] ) : Promise<void>;
	render( template:string, data:any ) : string;

	ui: TUiRunContext;

	io: TIoRunContext;

	dv: DataviewApi | undefined;

}

type TUiRunContext = {
	notice( message: string | DocumentFragment, timeout?: number ) : void;
	rebuild() : Promise<void>;
	message( titleOrMessage:string, message?:string ) : Promise<void>;
	ask(
		titleOrQuestion:string,
		questionOrOptions?:string|string[],
		options?:string[]
	) : Promise<string|undefined>;
}

type TIoRunContext = {
	import( path:string ) : Promise<boolean>;
	load( path:string ) : Promise<string|undefined>;
	load_data( path:string, name?:string ) : Promise<DataSet>;
	load_data_url( path:string, mimetype?:string ) : Promise<string|undefined>;
	output( file:string, content:string, open?:boolean ) : void;
	open( linktext:string ) : void;
	delete( path:string ) : void;
}

class Parser {

	public applyMarkdownContent(
		name:string,
		content:string,
		data:IDataSetCollection,
		templates:string[]
	) : void {
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
				templates.push( templateLines.join('\n') );
			}
		}
	}

	private extractHeader(line:string) : string{
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
		for ( let i = 0; i < fileCache.sections.length; i++ ) {
			const section = fileCache.sections[i];
			if ( section.type == 'heading' ){
				headingIdx++;
				lastHeading = fileCache.headings?.at(headingIdx)?.heading ?? '?';
				//console.debug({lastHeading});
			} 
			if ( section.type == 'table' ){

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
	): string[] {
		const result: string[] = [];
		
		if ( fileCache == undefined ){
			return result;
		}

		if ( fileCache.sections == undefined ){
			return result;
		}
		
		fileCache.sections.forEach( section => {
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
			result.push( lines.join('\n') );
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



class Logger {

	private file: TFile|undefined;

	private console_info( ...params: any[] ){
		window.console.info( 'meld-build', ...params );
	}

	private console_error( ...params: any[] ){
		window.console.error( 'meld-build', ...params );
	}

	private async file_log( prefix:string, ...params: any[] ){
		if (!this.file){
			return;
		}
		if ( params.length == 0 ){
			return;
		}

		let content = '';
		let isJson = false;
		if (
			params.length == 1
			&& typeof(params[0]) != 'object'
			&& typeof(params[0]) != 'function'
			&& typeof(params[0]) != 'symbol'
		){
			content = params[0].toString();
		}else{
			isJson = true;
			content = JSON.stringify(params, null, '  ');
		}

		const fmtPrefix = prefix.length > 0 ? ` [${prefix}] ` : '';

		let logLine: string;
		if ( isJson ){
			logLine = '```json\n'
				+ fmtPrefix.trim() + '\n'
				+ content + '\n```'
			;
		} else if (content.contains('\n')){
			// multiline
			logLine = '```\n' + fmtPrefix + content + '\n```';
		}else{
			// single line
			logLine = '`' + (fmtPrefix + content).trim() + '`';
		}

		logLine += '\n';

		await app.vault.append( this.file, logLine );
		
	}

	public async set_file( filename: string|undefined, clear = true ){
		if ( !filename ){
			this.file = undefined;
			return;
		}

		const filepath = Utils.getSameFolderFilepath(filename);

		const af = app.vault.getAbstractFileByPath(filepath);
		if ( af instanceof TFile ){
			this.file = af;
			if ( clear == true ){
				app.vault.modify( this.file, '' );
			}
		}else{
			this.file = await app.vault.create( filepath, '' );
		}
	}

	public async info( ...params: any[] ): Promise<void>{
		this.console_info( ...params );
		await this.file_log( 'info', ...params );
	}

	public async error( ...params: any[] ): Promise<void>{
		this.console_error( ...params );
		await this.file_log( 'error', ...params );
	}

}



class Compiler{

	public compile( logger: Logger, editor: Editor, view: MarkdownView ) : () => void {

		const fileCache = app.metadataCache.getFileCache(view.file);

		if (fileCache == null){
			return async () => {};
		}

		// build context
		const context = this.build_run_context(logger, editor, fileCache, view);

		// return runner
		return () => this.buildSandboxedRunnerFunction(context);
		//return () => this.buildRunnerFunction(sourceCode, context);
	}

	private build_run_context(
		log: Logger,
		editor: Editor,
		fileCache:CachedMetadata,
		view: MarkdownView
	) : TRunContext {
		const pzr = new Parser();
		
		// data
		const data = pzr.fetchData(editor, fileCache);

		// code
		const codeBlocks = pzr.fetchCodeBlocks(editor, fileCache, ['js', 'javascript']);

		// templates
		const templateBlocks = pzr.fetchCodeBlocks(editor, fileCache, ['html']);

		return {
			sourceCode: codeBlocks.join('\n'),

			data: data,
			templates: templateBlocks,

			logger : log,
			log: async (...x) => await log.info( ...x ),

			render( template, data ) {
				const templateBuilder = HB.compile( template );
				const result = templateBuilder(data);
				return result;
			},

			ui: {
				notice(msg, timeout) {
					new Notice( msg, ( timeout ?? 5 ) * 1000 );
				},

				async rebuild() {
					await (view.leaf as any).rebuildView();
				},

				async message( titleOrMessage:string, message?:string  ) : Promise<void> {
					const m = new MessageModal(app);

					let title: string;
					let msg: string;
					if (message == undefined){
						msg = titleOrMessage;
						title = '';
					}else{
						title = titleOrMessage;
						msg = message;
					}

					await m.execute(title, msg);
					//console.log('message, after open');
				},

				async ask(
					titleOrQuestion:string,
					questionOrOptions?:string|string[],
					options?:string[]
				) : Promise<string|undefined> {
					console.log({titleOrQuestion, questionOrOptions, options});
					const m = new AskModal(app);

					let finTitle: string;
					let finQuestion: string;
					let finOptions: string[];

					if ( questionOrOptions != undefined ){
						if ( typeof questionOrOptions == 'string' ){
							finTitle = titleOrQuestion;
							finQuestion = questionOrOptions;
							finOptions = options ?? [];
						}else {
							finTitle = '';
							finQuestion = titleOrQuestion;
							finOptions = questionOrOptions ?? [];
						}
					} else {
						finTitle = '';
						finQuestion = titleOrQuestion;
						finOptions = [];
					}

					await m.execute(
						finTitle,
						finQuestion,
						finOptions
					);
					return m.answer;
				}
			},
			
			io: {
				
				import : async (filepath) => await this.import(log, data, templateBlocks, filepath ),

				async load(path):Promise<string|undefined> {
					const filepath = Utils.getSameFolderFilepath(path);
					
					const af = app.vault.getAbstractFileByPath(filepath);
					
					if (!(af instanceof TFile)){
						return Promise.resolve(undefined);
					}

					return await app.vault.read(af)
				},

				load_data: async (filepath, name) => await this.data_loader(data, filepath, name),
				
				//load_template: (filepath) => this.template_loader(templateBlocks, filepath),
	
				async load_data_url(path, mimetype) : Promise<string|undefined> {
					const filepath = Utils.getSameFolderFilepath(path);
					
					const af = app.vault.getAbstractFileByPath(filepath);
					
					if (!(af instanceof TFile)){
						return Promise.resolve(undefined);
					}

					const finalMimeType = mimetype ?? {
						'jpg':'image/jpeg',
						'png':'image/png',
						'gif':'image/gif',
						'svg':'image/svg+xml',
					}[af.extension] ?? '';
					const content = await app.vault.read(af);
					const buf = Buffer.from(content);
					const base64Data = buf.toString('base64');
					return `data:${finalMimeType};base64,${base64Data}`;
				},

				async output (filename, content, open) {

					const newFilepath = Utils.getSameFolderFilepath(filename);
				
					const af = app.vault.getAbstractFileByPath(newFilepath);
					if (af instanceof TFile){
						await app.vault.trash(af, false);
					}
	
					await app.vault.create( newFilepath, content );
				
					//new Notice(`${newFilepath} created`);
					if (open == true){
						await app.workspace.openLinkText( newFilepath, '' );
					}
				},

				async open( linktext ) {
					await app.workspace.openLinkText( linktext, '' );
				},

				async delete(path) {
					const filepath = Utils.getSameFolderFilepath(path);
					const af = app.vault.getAbstractFileByPath(filepath);
					if (af instanceof TFile){
						await app.vault.trash(af, false);
					}
				},
			},

			dv: dvGetAPI(),
		}
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

	private async template_loader(templates: string[], filepath:string) : Promise<string>{
		let resultContent = '';

		const absFilepath = this.getAbsoluteFilepathFromActiveFile(filepath);
		if (!absFilepath){
			return resultContent;
		}
		const file = app.vault.getAbstractFileByPath(absFilepath);
		if (file instanceof TFile){
			resultContent = await app.vault.read( file );
			templates.push(resultContent);
		}
		

		return resultContent;
	}

	private async import(
		log: Logger,
		data: IDataSetCollection,
		templates: string[],
		path:string
	) : Promise<boolean>{

		const absFilepath = this.getAbsoluteFilepathFromActiveFile(path);
		if (!absFilepath){
			log.error(`import::Unable to get file path from active file: "${path}"`);
			return false;
		}

		const file = app.vault.getAbstractFileByPath(absFilepath);
		
		if (!(file instanceof TFile)){
			log.error(`import::File not found: "${path}"`);
			return false;
		}

		if ( file.extension == 'md' ){
			const content = await app.vault.read( file );
			const pzr = new Parser();
			pzr.applyMarkdownContent( file.basename, content, data, templates);
			return true;
		}else{
			log.error(`import::Unimplemented file extension: "${path}"`);
			return false;
		}
			
	}
	
	private buildRunnerFunction(code:string, context:TRunContext) : FunctionConstructor {
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

	private buildSandboxedRunnerFunction(context:TRunContext) : FunctionConstructor {
		const frame = document.createElement('iframe');
		document.body.appendChild(frame);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const f = (frame.contentWindow as any).Function as FunctionConstructor;
		document.body.removeChild(frame);
		
		
		const restrictedKeys = [
			...Object.keys(frame.contentWindow??{}),
			'self',
			'document'
		];
		const undefineds = restrictedKeys.map( v=>undefined );

		const errFrag = new DocumentFragment();
		errFrag.appendText('RUNTIME ERROR\n');

		const additionals = {
			'errFrag': errFrag
		};

		return f(
			...restrictedKeys,
			...Object.keys(additionals),
			'$',
			`
			'use strict';
			( async () => {
				${context.sourceCode}
			} )()
				.catch( (e) => {
					errFrag.appendText(e);
					$.logger.error(e);
					$.ui.notice(errFrag);
				})
			;
			`
		)(
			...undefineds,
			...Object.values(additionals),
			context
		);

	}
	


}