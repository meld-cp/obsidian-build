import { DataSet, DataSetRow, IDataSetCollection } from "src/data-set";
import { CachedMetadata, Editor } from "obsidian";

export class Parser {

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
