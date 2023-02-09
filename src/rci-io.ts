import { normalizePath, TFile, Vault, Workspace } from "obsidian";
import { EXTENSION_MIMETYPE_MAP } from "./constants";
import { DataSet, IDataSetCollection } from "./data-set";
import { NamedCodeBlock } from "./named-code-block";
import { Parser } from "./parser";
import { TIoRunContext } from "./run-context";
import { RunLogger } from "./run-logger";
import { Utils } from "./utils";

export class IoRunContextImplementation implements TIoRunContext {

	private vault: Vault;
	private workspace: Workspace;
	private log: RunLogger;
	private data:IDataSetCollection;
	private consumableBlocks:NamedCodeBlock[]

	constructor( vault:Vault, workspace:Workspace, log: RunLogger, data:IDataSetCollection, consumableBlocks:NamedCodeBlock[] ){
		this.vault = vault;
		this.workspace = workspace;
		this.log = log;
		this.data = data;
		this.consumableBlocks = consumableBlocks;
	}

	private getAbsoluteFilepathFromActiveFile( path:string ) : string | undefined {
		const activeFile = this.workspace.getActiveFile();
		if (activeFile == null){
			return;
		}
		return normalizePath( activeFile.parent.path + "/" + path );
	}

	private async data_loader(filepath:string, name?:string) : Promise<DataSet>{
		
		const absFilepath = this.getAbsoluteFilepathFromActiveFile(filepath);
		if (!absFilepath){
			return new DataSet([]);
		}
		
		const file = this.vault.getAbstractFileByPath(absFilepath);
		
		const pzr = new Parser();

		if (file instanceof TFile){

			if ( file.extension == 'csv'){
				const csvdata = await this.vault.read( file );
				const dataSet = pzr.loadCsv(csvdata);
				this.data[name??file.basename] = dataSet;
				return dataSet;
			}
		}
		
		return new DataSet([]);
	}

	async import(path: string): Promise<boolean> {
		const absFilepath = this.getAbsoluteFilepathFromActiveFile(path);
		if (!absFilepath){
			await this.log.error(`import::Unable to get file path from active file: "${path}"`);
			return false;
		}

		const file = this.vault.getAbstractFileByPath(absFilepath);
		
		if (!(file instanceof TFile)){
			await this.log.error(`import::File not found: "${path}"`);
			return false;
		}

		if ( file.extension == 'md' ){
			const content = await this.vault.read( file );
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
					
		const af = this.vault.getAbstractFileByPath(filepath);
		
		if (!(af instanceof TFile)){
			return undefined;
		}

		return await this.vault.read(af)
	}

	async load_data(path: string, name?: string | undefined): Promise<DataSet> {
		return await this.data_loader( path, name );
	}

	async load_data_url(path: string, mimetype?: string | undefined): Promise<string | undefined> {
		const filepath = Utils.getSameFolderFilepath(path);
					
		const af = this.vault.getAbstractFileByPath(filepath);
		
		if (!(af instanceof TFile)){
			return Promise.resolve(undefined);
		}

		const finalMimeType = mimetype
			?? EXTENSION_MIMETYPE_MAP.get(af.extension)
			?? ''
		;

		const base64Data = Utils.toBase64( await this.vault.readBinary(af) );
		
		return `data:${finalMimeType};base64,${base64Data}`;
	}

	async output(file: string, content: string, open?: boolean | undefined): Promise<void> {
		const newFilepath = Utils.getSameFolderFilepath(file);
				
		const af = this.vault.getAbstractFileByPath(newFilepath);
		if (af instanceof TFile){
			await this.vault.trash(af, false);
		}

		await this.vault.create( newFilepath, content );
	
		//new Notice(`${newFilepath} created`);
		if (open == true){
			await this.workspace.openLinkText( newFilepath, '' );
		}
	}

	async open(linktext: string): Promise<void> {
		await this.workspace.openLinkText( linktext, '' );
	}

	async delete(path: string): Promise<void> {
		const filepath = Utils.getSameFolderFilepath(path);
		const af = this.vault.getAbstractFileByPath(filepath);
		if (af instanceof TFile){
			await this.vault.trash(af, false);
		}
	}

}