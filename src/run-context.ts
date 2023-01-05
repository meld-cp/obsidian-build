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

	assert:TAssertRunContext;

	ui: TUiRunContext;

	io: TIoRunContext;

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
	isDefined( value:any, label?:string  ) : Promise<void>;
	isTrue( value:any, label?:string  ) : Promise<void>;
	isFalse( value:any, label?:string  ) : Promise<void>;
	eq( expected:any, actual:any, label?:string ) : Promise<void>;
	neq( expected:any, actual:any, label?:string ) : Promise<void>;
}