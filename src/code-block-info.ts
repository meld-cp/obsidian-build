import { CODE_BLOCK_LANG_TOOLBAR } from "./constants";

export class CodeBlockInfo{
	
	public language:string;
	public params:string[];

	constructor( language: string, params?:string[] ){
		this.language = language;
		this.params = params ?? [];
	}

	
}

export class CodeBlockInfoHelper {

	public static isRunnable( info: CodeBlockInfo ):boolean{
		return ['js', 'javascript'].contains( info.language )
			&& info.params.at(0) === 'meld-build'
			&& !info.params.contains( 'skip' )
		;
	}

	public static isConsumable( info: CodeBlockInfo ) : boolean{
		return info.language != CODE_BLOCK_LANG_TOOLBAR
			&& info.params.at(0) !== 'meld-build'
		;
	}

}