export class DataSet extends Array<DataSetRow> {
	
	public columns:string[] = [];

	constructor( columnNames:string[] ){
		super();
		
		//console.debug( "DataSet:", {columnNames} );

		if ( Array.isArray( columnNames ) && columnNames.length > 0 ){
			this.columns = columnNames.map( cn => cn.trim() );
		}

	}

	private extractAsColumnName( str:string ) : string {
		return str.trim().replaceAll(/\W/ig, '_').toLowerCase().trim();
	}

	public getPropertyName ( colName:string ) : string | undefined {
		return this.extractAsColumnName( colName );
	}

}

export interface IDataSetCollection {
	[name:string] : DataSet;
}

interface IRowDataValueCollection {
	[column:string | number] : unknown
}

export class DataSetRow implements IRowDataValueCollection{
	
	[column: string]: unknown;

	constructor( dataSet:DataSet, values: unknown[] ){
		const columns = dataSet.columns;
		for ( let colIdx = 0; colIdx < columns.length; colIdx++ ) {
			const rawColName = columns[colIdx];
			const propColName = dataSet.getPropertyName(rawColName);
			if ( propColName !== undefined ){
				this[propColName] = values.at(colIdx);
			}
		}
	}

}



