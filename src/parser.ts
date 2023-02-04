import { DataSet, DataSetRow, IDataSetCollection } from "src/data-set";
import { MarkdownView } from "obsidian";
import { NamedCodeBlock } from "./named-code-block";
import { CodeBlockInfo, CodeBlockInfoHelper } from "./code-block-info";

export class Parser {

	public async fetchCodeBlocks(
		view: MarkdownView,
		languages? : string[]
	): Promise<NamedCodeBlock[]> {
		const result: NamedCodeBlock[] = [];
		
		const file = view.file;
		const fileContent = await view.app.vault.read(file);
		const fileCache = view.app.metadataCache.getFileCache( file );

		if ( fileCache == null ){
			console.debug('Parser::fetchCodeBlocks, fileCache is null');
			return result;
		}

		if ( fileCache.sections == undefined ){
			console.debug('Parser::fetchCodeBlocks, fileCache.sections is undefined');
			return result;
		}
		
		const headerOrCodeBlockList = fileCache.sections?.filter( s => ['heading','code'].contains( s.type ) ) ?? [];

		let cbName = '';
		headerOrCodeBlockList.forEach( headerOrCodeBlockSection => {
			
			const content = fileContent.slice(
				headerOrCodeBlockSection.position.start.offset,
				headerOrCodeBlockSection.position.end.offset
			)

			if ( headerOrCodeBlockSection.type == 'heading' ){
				cbName = this.extractHeaderName(content);
				return;
			}

			// code block
			const lines = content.replaceAll('\r\n', '\n').split('\n');
			if ( lines.length <= 2 ){
				//console.debug('Parser::fetchCodeBlocks, codeblock lines <= 2');
				return;
			}

			// filter languages
			const codeBlockInfo = this.extractCodeBlockInfo(lines[0]);
			if ( codeBlockInfo == null ){
				console.debug('Parser::fetchCodeBlocks, codeBlockInfo is null', {content});
				return;
			}

			if ( languages &&  !languages.contains( codeBlockInfo.language ) ){
				return;
			}

			// remove first and last lines
			const cbContent = lines.slice(1,-1).join('\n');

			const codeBlock = new NamedCodeBlock( codeBlockInfo, cbName, cbContent );

			result.push( codeBlock );

		});
		
		return result;
	}
	
	private extractCodeBlockInfo( line:string ) : CodeBlockInfo | null {
		/*
		match tests
			```lang 					=> { language: 'lang', params:[] }
			```lang with space			=> { language: 'lang', params:['with','space'] }
			```  whitespaced			=> { language: 'whitespaced', params:[] }
			```` multitick				=> { language: 'multitick', params:[] }
			````multitick with space	=> { language: 'multitick', params:['with','space'] }
		*/
		const codeBlockMatch = line.match(/````*\s*([\w\s\\-]*)/);
		//const matches = line.match(/````*/i);
		
		if ( codeBlockMatch == null || codeBlockMatch.length < 1 ){
			console.debug('Parser::extractCodeBlockInfo, codeBlockMatch is null or length < 1', {codeBlockMatch, line});
			return null;
		}

		const langAndParamsText = codeBlockMatch[1];

		const langAndParamsMatches = langAndParamsText.split(/\s/);

		const lang = langAndParamsMatches.at(0);
		if ( lang === undefined ){
			return null;
		}

		const params:string[] = langAndParamsMatches.slice(1).filter( e => e !== undefined );
		
		return new CodeBlockInfo( lang, params );
	}

	public loadCsv( csvContent:string ) : DataSet {
		const lines = csvContent.split('\n').map( e=>e.trim() );
		if (lines.length == 0){
			return new DataSet();
		}
		
		const columns = lines.first()?.split(',').map( e => this.extractAsColumnName(e) ) ?? [];
		
		const rows = new Array<DataSetRow>();

		for (let i = 1; i < lines.length; i++) {
			const rowData = lines[i].split(',').map( d => this.extractValueFromString(d));
			rows.push( new DataSetRow(columns, rowData));
		}

		const ds = new DataSet( ...rows );
		
		return ds;
	}

	public applyMarkdownContent(
		name:string,
		content:string,
		data:IDataSetCollection,
		consumableCodeBlocks:NamedCodeBlock[]
	) : void {

		const lines = content.split('\n');

		let currentHeader = '';
		for ( let i = 0; i < lines.length; i++ ) {
			const trimLine = lines[i].trim();

			const codeBlockInfo = this.extractCodeBlockInfo(trimLine);

			if ( trimLine.startsWith('#') ) {
				
				// header
				currentHeader = this.extractHeaderName(trimLine);

			} else if ( trimLine.startsWith('|') ){
				
				// extract table
				const tableLines: string[] = [];
				while( i < lines.length && lines[i].trim().startsWith('|') ){
					const tableLine = lines[i].trim();
					tableLines.push(tableLine);
					i++;
				}
				const dataPropName = this.extractAsTableName( currentHeader.length > 0 ? currentHeader : name );
				data[dataPropName] = this.parseMdTable(tableLines);

			} else if ( codeBlockInfo && CodeBlockInfoHelper.isConsumable( codeBlockInfo ) ){
				
				// extract consumable codeblock
				const blockLines: string[] = [];
				i++;
				while( i < lines.length && !lines[i].trim().startsWith('```') ){
					const blockLine = lines[i];
					blockLines.push(blockLine);
					i++; 
				}

				const codeBlock = new NamedCodeBlock(
					codeBlockInfo,
					name,
					blockLines.join('\n')
				);
				
				consumableCodeBlocks.push( codeBlock );
				
			}
		}
	}

	private extractHeaderName(line:string) : string{
		return line.replaceAll('#','').trim();
	}

	private parseMdTable( tableLines:string[] ): DataSet {
		const data: DataSet = new DataSet();
		
		const tlines = tableLines
		.map( e=>e.trim().slice(1,-1).trim());

		const columns = tlines
			.first()?.split('|')
			.map( e=> this.extractAsColumnName(e) )
			.filter( e=>e.length > 0)
			?? []
		;

		for (let i = 1; i < tlines.length; i++) {
			const rowLine = tlines[i];
			if (rowLine.startsWith('---') ){
				continue;
			}
			if (rowLine.startsWith('|') && rowLine.endsWith('|')){
				continue;
			}
			const rowValues : unknown[] = rowLine.split('|').map( e => this.extractValueFromString(e) );
			data.push( new DataSetRow( columns, rowValues ) );
		}

		return data;
	}

	public async fetchData( view: MarkdownView ): Promise<IDataSetCollection> {
		const result:{
			[index:string] : DataSet
		} = {};
		
		const file = view.file;
		const fileContent = await view.app.vault.read(file);
		const fileCache = view.app.metadataCache.getFileCache( file );

		if ( fileCache == null ){
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
			} 
			if ( section.type == 'table' ){

				// const from = editor.offsetToPos(section.position.start.offset);
				// const to = editor.offsetToPos(section.position.end.offset);
				// const table = editor.getRange( from, to );
				const table = fileContent.slice(
					section.position.start.offset,
					section.position.end.offset
				)
				const tableLines = table.split('\n');
				const data = this.parseMdTable(tableLines);

				const tableName = this.extractAsTableName(lastHeading);
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

	private extractAsTableName( str:string ) : string {
		return str.trim().replaceAll(/\W/ig, '_').toLowerCase();
	}

	private extractAsColumnName( str:string ) : string {
		return str.trim().replaceAll(/\W/ig, '_').toLowerCase();
	}
	
	private extractValueFromString( str:string ) : string | number | Date {
		const trimmed = str.trim();

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

	
}
