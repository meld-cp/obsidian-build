export class CodeBlockInfo{
	public language:string;
	public params:string[];
	constructor( language: string, params?:string[] ){
		this.language = language;
		this.params = params ?? [];
	}
}