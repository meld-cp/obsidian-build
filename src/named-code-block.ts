import { CodeBlockInfo } from "./code-block-info";

export class NamedCodeBlock{

	public info:CodeBlockInfo;
	public name:string;
	public content:string;

	constructor( info:CodeBlockInfo, name:string, content:string ){
		this.info = info,
		this.name = name;
		this.content = content;
	}
}