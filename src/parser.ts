import { DataSet, DataSetRow, IDataSetCollection } from "src/data-set";
import { CachedMetadata, Editor } from "obsidian";
import { NamedCodeBlock } from "./named-code-block";
import { CodeBlockInfo } from "./code-block-info";

export class Parser {

	public fetchCodeBlocks(
		editor: Editor,
		fileCache: CachedMetadata | undefined,
		languages? : string[]
	): NamedCodeBlock[] {
		const result: NamedCodeBlock[] = [];
		
		if ( fileCache == undefined ){
			return result;
		}

		if ( fileCache.sections == undefined ){
			return result;
		}
		
		//console.log(fileCache.sections);
		const codeBlocks = fileCache.sections?.filter( s => ['heading','code'].contains( s.type ) ) ?? [];
		//console.debug({codeBlocks});

		let cbName = '';
		codeBlocks.forEach( codeBlockSection => {
			
			const from = editor.offsetToPos( codeBlockSection.position.start.offset );
			const to = editor.offsetToPos( codeBlockSection.position.end.offset );
			const content = editor.getRange( from, to );
			
			//console.debug(content);

			if ( codeBlockSection.type == 'heading' ){
				cbName = this.extractHeaderName(content);
				return;
			}

			// code block
			const lines = content.split('\n');
			if ( lines.length <= 2 ){
				return;
			}

			// filter languages
			const codeBlockInfo = this.extractCodeBlockInfo(lines[0]);
			if (!codeBlockInfo){
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
		const matches = line.match(/````*\s*([a-z0-9-]+)(?:\s*([a-z0-9-]+))*/i);
		
		//console.debug(matches);

		if ( matches == null ){
			return null;
		}

		const lang = matches.at(1);
		if ( lang === undefined ){
			return null;
		}

		const params:string[] = matches.slice(2).filter( e => e );
		//console.debug({params});
		
		return new CodeBlockInfo( lang, params );
	}

	// private matchesCodeBlockStart( line:string, languages:string[] ) : boolean {
		
	// 	const cbInfo = this.extractCodeBlockInfo(line);

	// 	if ( cbInfo == null ){
	// 		return false;
	// 	}
		
	// 	return languages.contains( cbInfo?.language );
	// }

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
		templates:NamedCodeBlock[],
		templateLanguageFilter: string[]
	) : void {

		const lines = content.split('\n');
		//console.debug(lines);

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

			} else if ( codeBlockInfo && templateLanguageFilter.contains( codeBlockInfo.language ) ){
				
				// extract template codeblock
				const templateLines: string[] = [];
				i++;
				while( i < lines.length && !lines[i].trim().startsWith('```') ){
					const templateLine = lines[i];
					templateLines.push(templateLine);
					i++; 
				}

				const codeBlock = new NamedCodeBlock(
					codeBlockInfo,
					name,
					templateLines.join('\n')
				);
				
				templates.push( codeBlock );
				
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

		//console.debug(tableLines);
		const columns = tlines
			.first()?.split('|')
			.map( e=> this.extractAsColumnName(e) )
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
			const rowValues : unknown[] = rowLine.split('|').map( e => this.extractValueFromString(e) );
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

	
}
