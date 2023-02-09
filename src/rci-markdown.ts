import { DataSet } from "./data-set";
import { TMarkdownHelperRunContext } from "./run-context";
import { RunLogger } from "./run-logger";

export class MarkdownHelperRunContextImplementation implements TMarkdownHelperRunContext{
    
    private log: RunLogger;

    constructor( log: RunLogger ){
		this.log = log;
	}
    
    private buildTable(headings: string[], rows: any[][]): string{
        return MarkdownTableHelper.buildTable( headings, rows );
    }

    buildTableFromDataSet(data: DataSet): string {
        const headings = data.columns;
        const rowValues : any[][] = [];
        
        for (const row of data) {
            const values : any[] = [];

            for (const heading of headings) {
                const prop = data.getPropertyName(heading);
                const value = prop == undefined ? undefined : row[prop];
                values.push(value);
            }

            rowValues.push( values );
        }
        
        return MarkdownTableHelper.buildTable( headings, rowValues );
    }
    
    public table(arg1: unknown, arg2?: unknown): string {
        if (arg1 instanceof DataSet){
            return this.buildTableFromDataSet(arg1);
        }
        if ( Array.isArray(arg1) && Array.isArray(arg2) ){
            return this.buildTable(arg1, arg2);
        }
        throw new Error('Invalid args for markdown table');
    }

}

class MarkdownTableHelper {


    public static buildTable(headings: string[], rowValues: any[][]): string{
        
        const headers = MarkdownTableHelper.buildHeaderRows( headings );
        const rows = MarkdownTableHelper.buildValueRows( rowValues );

        const lines = [
            '',
            ...headers,
            ...rows,
            '',
        ]

        console.debug({lines});

        return lines.join('\n');
	
    }



    private static removeHeaderFormat( header: string ) : string {
        if ( header.startsWith('<') || header.startsWith('>') ){
            return header.slice(1);
        }
        return header;
    }

    private static buildFormatRowCell( header: string ): string {
        let leftMarker = ' ';
        let rightMarker = ' ';
        
        if ( header.startsWith('<') ){
            leftMarker = ':';
            header = header.slice(1);
        } else if ( header.startsWith('>') ){
            rightMarker = ':';
            header = header.slice(1);
        }else{
            leftMarker = ':';
            rightMarker = ':';
            header = header;
        }
        
        return leftMarker + '-'.repeat( header.length ) + rightMarker;
    }

    private static buildHeaderRows( formattedHeadings: string[] ) : string[] {
        var result : string[] = [];
        result.push( '|' + formattedHeadings.map( header => ` ${MarkdownTableHelper.removeHeaderFormat(header)} ` ).join('|') + '|' );
        result.push( '|' + formattedHeadings.map( header => MarkdownTableHelper.buildFormatRowCell(header) ).join('|') + '|' );
        return result;
    }

    private static buildValueRow( rowValues: any[] ) : string {
        return '|' + rowValues.map( c => ` ${c} ` ).join('|') + '|';
    }


    private static buildValueRows( valueRows: any[][] ) : string[] {
        return valueRows.map( rowValues => MarkdownTableHelper.buildValueRow(rowValues) );
    }

    
}