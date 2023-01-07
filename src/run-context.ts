import { DataSet, IDataSetCollection } from "src/data-set";
import { DataviewApi } from "obsidian-dataview";
import { RunLogger } from "src/run-logger";
import { NamedCodeBlock } from "./named-code-block";

export type TRunContext = {

	sourceCode: string;

	data: IDataSetCollection;
	blocks: NamedCodeBlock[];

	logger: RunLogger,
	log( ...params: any[] ) : Promise<void>;
	render( template:string|NamedCodeBlock, data:any ) : string;

	assert: TAssertRunContext;

	ui: TUiRunContext;

	io: TIoRunContext;

	markers: TMarkerRunContext;

	dv: DataviewApi | undefined;

}

export type TUiRunContext = {
	notice( message: string | DocumentFragment, timeout?: number ) : void;
	rebuild() : Promise<void>;
	message(
		titleOrMessage:string|number,
		message?:string|number
	) : Promise<void>;
	ask(
		titleOrQuestion:string,
		questionOrOptions?:string|string[],
		options?:string[]
	) : Promise<string|undefined>;
}

export type TIoRunContext = {
	import( path:string ) : Promise<boolean>;
	load( path:string ) : Promise<string|undefined>;
	load_data( path:string, name?:string ) : Promise<DataSet>;
	load_data_url( path:string, mimetype?:string ) : Promise<string|undefined>;
	output( file:string, content:string, open?:boolean ) : Promise<void>;
	open( linktext:string ) : Promise<void>;
	delete( path:string ) : Promise<void>;
}

export type TAssertRunContext = {
	isDefined( value:any, label?:string ) : Promise<void>;
	isTrue( value:any, label?:string ) : Promise<void>;
	isFalse( value:any, label?:string ) : Promise<void>;
	eq( expected:any, actual:any, label?:string ) : Promise<void>;
	neq( expected:any, actual:any, label?:string ) : Promise<void>;
}

export type TMarkerRunContext = {
	// mark_start_prefix: string;
	// mark_start_suffix: string;
	// mark_end_prefix: string;
	// mark_end_suffix: string;

	// target_path: string | null;

	define_mark_start( prefix:string, suffix:string ) : void;
	define_mark_end( prefix:string, suffix:string ) : void;

	target_file( path?:string ) : void;

	clear() : void;

	set( name:string, value:string|null ): void;

	fetch() : Promise<MarkerValue[]>;

	apply( clearUnknownMarkerValues?:boolean ) : Promise<MarkerChange[]>;
}

// export class MarkerLocation{
// 	line: number;
// 	pos: number;
// 	constructor( line:number, pos: number ){
// 		this.line = line;
// 		this.pos = pos;
// 	}
// }

export class MarkerValue {
	posIndex: number;
	name: string;
	value: string;
	constructor( posIndex: number, name:string, value:string ){
		this.posIndex = posIndex;
		this.name = name;
		this.value = value;
	}
}

export class MarkerChange{
	posIndex: number;
	name: string;
	old: string;
	new: string;

	constructor( posIndex: number, name:string, oldValue:string, newValue:string ){
		this.posIndex = posIndex;
		this.name = name;
		this.old = oldValue;
		this.new = newValue;
	}
}

