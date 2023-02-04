import { arrayBufferToBase64, normalizePath, TFile } from "obsidian";

export class Utils{

	public static getSameFolderFilepath(
		filename: string,
		siblingFile?:TFile
	): string{
		const baseFile = siblingFile ?? app.workspace.getActiveFile();
		let parentPath = baseFile?.parent.path ?? app.vault.getRoot().path;

		if (!parentPath.endsWith('/')){
			parentPath += '/'
		}

		const finalFilename = normalizePath(filename)
			.replace('..', '_')
		;

		return normalizePath( parentPath + finalFilename );
	}
	
	public static toBase64( buf: ArrayBuffer ) : string {
		return arrayBufferToBase64( buf );
	}
}