import { MarkdownView, Notice } from "obsidian";
import {getAPI as dvGetAPI} from "obsidian-dataview";
import * as HB from  'handlebars';
import { Parser } from "src/parser";
import { RunLogger } from 'src/run-logger';
import { TRunContext } from "src/run-context";
import { NamedCodeBlock } from "./named-code-block";
import { CodeBlockInfoHelper } from "./code-block-info";
import { AssertRunContextImplemention } from "./rci-assert";
import { UiRunContextImplemention } from "./rci-ui";
import { IoRunContextImplemention } from "./rci-io";
import { MarkerRunContextImplemention } from "./rci-markers";

export class Compiler{

	public async compile(
		logger: RunLogger,
		view: MarkdownView,
		runGroupTag?: string
	) : Promise<(() => void) | null> {

		// build context
		const context = await this.build_run_context( logger, view, runGroupTag );

		if (context == null){
			return function() {
				new Notice(
					'No JavaScript blocks were found marked with "meld-build"'
					+ ( runGroupTag !=undefined ? ` (Tag group=${runGroupTag})` : '' )
				);
			};
		}

		// return runner
		return () => this.buildSandboxedRunnerFunction(context, this.runtimeErrorHandler );

	}

	private runtimeErrorHandler( context:TRunContext, e:any ):void{

		const lineNoPadding = 4;
		const sourceLines = context.sourceCode.split('\n').map( (l, i) => `${String(i+1).padStart(lineNoPadding, ' ')}: ${l}` );
		const stackLines = (e.stack as string)?.split('\n') ?? [];
		const errorLineMatch = stackLines[1].match(/[<]anonymous[>]:(\d*):(\d*)/s);

		let errLineNo : number|undefined = undefined;
		let errLineCharNo : number|undefined = undefined;
		let sourceErrorLines : string[] = [];

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
		}



		context.logger.error(
			e,
			{
				errorListing: ['=== RUNTIME ERROR ===', ...sourceErrorLines],
				fullListing: ['=== FULL LISTING ===', ...sourceLines ],
			}
		);

		const errFrag = new DocumentFragment();
		errFrag.createDiv({text: 'RUNTIME ERROR'}, el =>{
			el.style.fontWeight = 'bold';
		});
		
		errFrag.createEl('pre', { text: sourceErrorLines.join('\n') }, el=>{
			el.style.whiteSpace = 'pre-wrap';
		} );

		errFrag.createDiv( { text: 'See the console log for more details' }, el =>{
			el.style.fontWeight = 'bold';
		});
		
		context.ui.notice(errFrag, 20); 
	}

	private async build_run_context(
		log: RunLogger,
		view: MarkdownView,
		runGroupTag?: string
	) : Promise<TRunContext | null> {
		const pzr = new Parser();
		
		// data
		const data = await pzr.fetchData( view );

		// code blocks
		const allCodeBlocks = await pzr.fetchCodeBlocks( view );

		// runnable code blocks
		const runnableCodeBlocks = allCodeBlocks
			.filter( cb => CodeBlockInfoHelper.isRunnable( cb.info ) )
			.filter( cb => runGroupTag == undefined || cb.info.params.contains( runGroupTag ) )
		;
		if ( runnableCodeBlocks.length == 0 ){
			return null;
		}

		// source code
		const sourceCode = runnableCodeBlocks.map( e => e.content ).join('\n');

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

			assert: new AssertRunContextImplemention(),

			ui: new UiRunContextImplemention(),
			
			io: new IoRunContextImplemention(
				view.app.vault,
				view.app.workspace,
				log,
				data,
				consumableBlocks
			),

			markers: new MarkerRunContextImplemention(
				view.app.vault,
				log,
				view.file.path
			),

			dv: dvGetAPI(),
		}
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

