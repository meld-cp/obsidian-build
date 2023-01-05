import { CachedMetadata, Editor, MarkdownView, normalizePath, Notice, TFile } from "obsidian";
import {getAPI as dvGetAPI} from "obsidian-dataview";
import * as HB from  'handlebars';
import { MessageModal } from 'src/modal-message';
import { AskModal } from 'src/modal-ask';
import { Utils } from 'src/utils';
import { DataSet, IDataSetCollection } from "src/data-set";
import { Parser } from "src/parser";
import { RunLogger } from 'src/run-logger';
import { TRunContext } from "src/run-context";
import { NamedCodeBlock } from "./named-code-block";

export class Compiler{
	private templateLanguages = ['html', 'css'];

	public compile( logger: RunLogger, editor: Editor, view: MarkdownView ) : () => void {

		const fileCache = app.metadataCache.getFileCache(view.file);

		if (fileCache == null){
			return async () => {};
		}

		// build context
		const context = this.build_run_context(logger, editor, fileCache, view);

		//console.debug(context.sourceCode);

		// return runner
		return () => this.buildSandboxedRunnerFunction(context);
		//return () => this.buildRunnerFunction(sourceCode, context);
	}

	private build_run_context(
		log: RunLogger,
		editor: Editor,
		fileCache:CachedMetadata,
		view: MarkdownView
	) : TRunContext {
		const pzr = new Parser();
		
		// data
		const data = pzr.fetchData(editor, fileCache);

		// code
		const codeBlocks = pzr.fetchCodeBlocks( editor, fileCache, ['js', 'javascript'] );

		// templates
		const templateBlocks = pzr.fetchCodeBlocks( editor, fileCache, this.templateLanguages );


		// source code
		const sourceCode = codeBlocks.map( e=>e.content ).join('\n');

		//console.debug({sourceCode});

		return {
			sourceCode: sourceCode,

			data: data,
			templates: templateBlocks,

			logger : log,
			log: async (...x) => await log.info( ...x ),

			render( template:string|NamedCodeBlock, data:any ) {

				if( typeof template == 'string' ){
					return HB.compile( template )(data);
				}else if ( template instanceof NamedCodeBlock ){
					return HB.compile( template.content )(data);
				}

				return '';
			},

			ui: {
				notice(msg, timeout) {
					new Notice( msg, ( timeout ?? 5 ) * 1000 );
				},

				async rebuild() {
					await (view.leaf as any).rebuildView();
				},

				async message(
					titleOrMessage:string|number,
					message?:string|number
				) : Promise<void> {
					const m = new MessageModal(app);

					let title: string;
					let msg: string;

					if (message == undefined){
						msg = titleOrMessage.toString();
						title = '';
					}else{
						title = titleOrMessage.toString();
						msg = message.toString();
					}

					await m.execute(title, msg);
					//console.log('message, after open');
				},

				async ask(
					titleOrQuestion:string,
					questionOrOptions?:string|string[],
					options?:string[]
				) : Promise<string|undefined> {
					//console.log({titleOrQuestion, questionOrOptions, options});
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
				
				import : async (filepath) => await this.import( log, data, templateBlocks, filepath ),

				async load(path):Promise<string|undefined> {
					const filepath = Utils.getSameFolderFilepath(path);
					
					const af = app.vault.getAbstractFileByPath(filepath);
					
					if (!(af instanceof TFile)){
						return undefined;
					}

					return await app.vault.read(af)
				},

				load_data: async (filepath, name) => await this.data_loader( data, filepath, name ),
				
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
						'css':'text/css'
					}[af.extension] ?? '';

					const base64Data = Utils.toBase64( await app.vault.readBinary(af) );
					
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

				async open( linktext: string ) {
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
		log: RunLogger,
		data: IDataSetCollection,
		templates: NamedCodeBlock[],
		path:string
	) : Promise<boolean>{
		
		//console.log('import');

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
			//console.log({content});
			const pzr = new Parser();
			pzr.applyMarkdownContent(
				file.basename,
				content,
				data,
				templates,
				this.templateLanguages
			);
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