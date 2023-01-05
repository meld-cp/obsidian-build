export class DataSet extends Array<DataSetRow> {
	
}

export interface IDataSetCollection {
	[name:string] : DataSet;
}

interface IRowDataValueCollection {
	[column:string | number] : unknown
}

export class DataSetRow implements IRowDataValueCollection{
	
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



