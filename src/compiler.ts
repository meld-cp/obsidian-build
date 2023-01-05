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
import { CodeBlockInfoHelper } from "./code-block-info";
import { AssertImplemention } from "./assert-impl";

export class Compiler{

	public compile( logger: RunLogger, editor: Editor, view: MarkdownView ) : () => void {

		const fileCache = app.metadataCache.getFileCache(view.file);

		if (fileCache == null){
			return () => {};
		}

		// build context
		const context = this.build_run_context(logger, editor, fileCache, view);

		if (context == null){
			return function() {
				new Notice( 'No JavaScript blocks were found marked with "meld-build"' );
			};
		}

		// return runner
		return () => this.buildSandboxedRunnerFunction(context, this.runtimeErrorHandler );
		//return () => this.buildRunnerFunction(sourceCode, context);
	}

	private runtimeErrorHandler( context:TRunContext, e:any ):void{
		//throw new Error('Runtime error');
		//console.debug({context, e});
		const lineNoPadding = 4;
		const sourceLines = context.sourceCode.split('\n').map( (l, i) => `${String(i+1).padStart(lineNoPadding, ' ')}: ${l}` );
		const stackLines = (e.stack as string)?.split('\n') ?? [];
		const errorLineMatch = stackLines[1].match(/[<]anonymous[>]:(\d*):(\d*)/s);

		let errLineNo : number|undefined = undefined;
		let errLineCharNo : number|undefined = undefined;
		let sourceErrorLines : string[] = [];
		//let sourceErrorLineCharMarker = '';
		if ( errorLineMatch && errorLineMatch?.length > 2 ){
			const sourceLineOffset = 4;
			const lookAroundCount = 2;
			errLineNo = parseInt( errorLineMatch[1] ) - sourceLineOffset;
			errLineCharNo = parseInt( errorLineMatch[2] );
			const errLineIdx = errLineNo-1;
			const listingFromLineIdx = Math.max( 0, errLineIdx - lookAroundCount );
			const listingToLineIdx = Math.min( sourceLines.length-1, errLineIdx + 1 + lookAroundCount );

			const pointerPadding = lineNoPadding + 2;
			sourceErrorLines = [
				...sourceLines.slice(listingFromLineIdx,errLineIdx),
				sourceLines.at(errLineIdx) ?? '',
				' '.repeat(pointerPadding + errLineCharNo-1 ) + `^--- ${e}`,
				...sourceLines.slice(errLineIdx+1,listingToLineIdx),
			]
			//sourceErrorLineCharMarker = ' '.repeat(charNo-1) + '^';
		}



		context.logger.error(
			e,
			{
				errorListing: ['=== RUNTIME ERROR ===', ...sourceErrorLines],
				fullListing: ['=== FULL LISTING ===', ...sourceLines ],
			}
		);
		//context.logger.error( );
		
		//console.debug('=== RUNTIME ERROR ===');
		//console.debug('=== RUNTIME ERROR ===\n' + e + '\n\n' + sourceErrorLines.join('\n'));

		//console.debug('=== FULL LISTING ===\n' + sourceLines.join('\n') );

		const errFrag = new DocumentFragment();
		errFrag.createDiv({text: 'RUNTIME ERROR'}, el =>{
			el.style.fontWeight = 'bold';
		});
		//errFrag.appendText('MELD-BUILD - RUNTIME ERROR\n\n');
		errFrag.createEl('pre', { text: sourceErrorLines.join('\n') }, el=>{
			el.style.whiteSpace = 'pre-wrap';
		} );

		errFrag.createDiv( { text: 'See the console log for more details' }, el =>{
			el.style.fontWeight = 'bold';
		});
		
		context.ui.notice(errFrag, 20); 
	}

	private build_run_context(
		log: RunLogger,
		editor: Editor,
		fileCache:CachedMetadata,
		view: MarkdownView
	) : TRunContext | null {
		const pzr = new Parser();
		
		// data
		const data = pzr.fetchData( editor, fileCache );

		// code blocks
		const allCodeBlocks =  pzr.fetchCodeBlocks( editor, fileCache );

		// runable code blocks
		const runableCodeBlocks = allCodeBlocks
			.filter( cb => CodeBlockInfoHelper.isRunable( cb.info ) )
		;
		if ( runableCodeBlocks.length == 0 ){
			return null;
		}

		// source code
		const sourceCode = runableCodeBlocks.map( e => e.content ).join('\n');

		// consumable blocks
		const consumableBlocks = allCodeBlocks
			.filter( cb => CodeBlockInfoHelper.isConsumable( cb.info ) )
		;


		return {
			sourceCode: sourceCode,

			data: data,
			blocks: consumableBlocks,

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

			assert: new AssertImplemention(),

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

				},

				async ask(
					titleOrQuestion:string,
					questionOrOptions?:string|string[],
					options?:string[]
				) : Promise<string|undefined> {

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
				
				import : async (filepath) => await this.import( log, data, consumableBlocks, filepath ),

				async load(path):Promise<string|undefined> {
					const filepath = Utils.getSameFolderFilepath(path);
					
					const af = app.vault.getAbstractFileByPath(filepath);
					
					if (!(af instanceof TFile)){
						return undefined;
					}

					return await app.vault.read(af)
				},

				load_data: async (filepath, name) => await this.data_loader( data, filepath, name ),

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

		const file = app.vault.getAbstractFileByPath(absFilepath);

		const pzr = new Parser();
		if (file instanceof TFile){
			if (file.extension == 'csv'){
				const csvdata = await app.vault.read( file );
				resultDataSet = pzr.loadCsv(csvdata);
				data[name??file.basename] = resultDataSet;
			}
		}
		
		return resultDataSet;
	}

	private async import(
		log: RunLogger,
		data: IDataSetCollection,
		consumableBlocks: NamedCodeBlock[],
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
			pzr.applyMarkdownContent(
				file.basename,
				content,
				data,
				consumableBlocks
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

	private buildSandboxedRunnerFunction(
		context:TRunContext,
		runtimeErrorHandler: (context:TRunContext, e:any) => void
	) : FunctionConstructor {
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

		const additionals = {
			'runtimeErrorHandler': runtimeErrorHandler
		};

// 		const finalSourceOld = `'use strict';
// ( async () => {
// 	try{
// ${context.sourceCode}
// 	}catch(e){
// 		console.debug( { source: \`${context.sourceCode}\`, stack: e.stack.split('\\n') } );
// 		errFrag.appendText(e);
// 		$.logger.error(e);
// 		$.ui.notice(errFrag);
// 	}
// } )();`;

	const finalSource = `'use strict';
( async () => {
${context.sourceCode}
} )().catch( e => runtimeErrorHandler($,e) );`;
		return f(
			...restrictedKeys,
			...Object.keys(additionals),
			'$',
			finalSource
		)(
			...undefineds,
			...Object.values(additionals),
			context
		);

	}

}

