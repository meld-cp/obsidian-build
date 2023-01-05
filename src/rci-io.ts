import { normalizePath, TFile } from "obsidian";
import { DataSet, IDataSetCollection } from "./data-set";
import { NamedCodeBlock } from "./named-code-block";
import { Parser } from "./parser";
import { TIoRunContext } from "./run-context";
import { RunLogger } from "./run-logger";
import { Utils } from "./utils";

export class IoRunContextImplemention implements TIoRunContext {

	private log: RunLogger;
	private data:IDataSetCollection;
	private consumableBlocks:NamedCodeBlock[]

	constructor( log: RunLogger, data:IDataSetCollection, consumableBlocks:NamedCodeBlock[] ){
		this.log = log;
		this.data = data;
		this.consumableBlocks = consumableBlocks;
	}

	private getAbsoluteFilepathFromActiveFile( path:string ) : string | undefined {
		const activeFile = app.workspace.getActiveFile();
		if (activeFile == null){
			return;
		}
		return normalizePath( activeFile.parent.path + "/" + path );
	}

	private async data_loader(filepath:string, name?:string) : Promise<DataSet>{
		let resultDataSet = new DataSet();

		const absFilepath = this.getAbsoluteFilepathFromActiveFile(filepath);
		if (!absFilepath){
			return resultDataSet;
		}

		const file = app.vault.getAbstractFileByPath(absFilepath);

		const pzr = new Parser();
		if (file instanceof TFile){
			if (file.extension == 'csv'){
				const csvdata = await app.vault.read( file );
				resultDataSet = pzr.loadCsv(csvdata);
				this.data[name??file.basename] = resultDataSet;
			}
		}
		
		return resultDataSet;
	}

	async import(path: string): Promise<boolean> {
		const absFilepath = this.getAbsoluteFilepathFromActiveFile(path);
		if (!absFilepath){
			await this.log.error(`import::Unable to get file path from active file: "${path}"`);
			return false;
		}

		const file = app.vault.getAbstractFileByPath(absFilepath);
		
		if (!(file instanceof TFile)){
			await this.log.error(`import::File not found: "${path}"`);
			return false;
		}

		if ( file.extension == 'md' ){
			const content = await app.vault.read( file );
			const pzr = new Parser();
			pzr.applyMarkdownContent(
				file.basename,
				content,
				this.data,
				this.consumableBlocks
			);
			return true;
		}else{
			await this.log.error(`import::Unimplemented file extension: "${path}"`);
			return false;
		}
	}

	async load(path: string): Promise<string | undefined> {
		const filepath = Utils.getSameFolderFilepath(path);
					
		const af = app.vault.getAbstractFileByPath(filepath);
		
		if (!(af instanceof TFile)){
			return undefined;
		}

		return await app.vault.read(af)
	}

	async load_data(path: string, name?: string | undefined): Promise<DataSet> {
		return await this.data_loader( path, name );
	}

	async load_data_url(path: string, mimetype?: string | undefined): Promise<string | undefined> {
		const filepath = Utils.getSameFolderFilepath(path);
					
		const af = app.vault.getAbstractFileByPath(filepath);
		
		if (!(af instanceof TFile)){
			return Promise.resolve(undefined);
		}

		const finalMimeType = mimetype ?? {
			'jpg':'image/jpeg',
			'png':'image/png',
			'gif':'image/gif',
			'svg':'image/svg+xml',
			'css':'text/css'
		}[af.extension] ?? '';

		const base64Data = Utils.toBase64( await app.vault.readBinary(af) );
		
		return `data:${finalMimeType};base64,${base64Data}`;
	}

	async output(file: string, content: string, open?: boolean | undefined): Promise<void> {
		const newFilepath = Utils.getSameFolderFilepath(file);
				
		const af = app.vault.getAbstractFileByPath(newFilepath);
		if (af instanceof TFile){
			await app.vault.trash(af, false);
		}

		await app.vault.create( newFilepath, content );
	
		//new Notice(`${newFilepath} created`);
		if (open == true){
			await app.workspace.openLinkText( newFilepath, '' );
		}
	}

	async open(linktext: string): Promise<void> {
		await app.workspace.openLinkText( linktext, '' );
	}

	async delete(path: string): Promise<void> {
		const filepath = Utils.getSameFolderFilepath(path);
		const af = app.vault.getAbstractFileByPath(filepath);
		if (af instanceof TFile){
			await app.vault.trash(af, false);
		}
	}

}