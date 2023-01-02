import { TFile } from "obsidian";
import { Utils } from "src/utils";

export class RunLogger {

	private file: TFile|undefined;

	private console_info( ...params: any[] ){
		window.console.info( 'meld-build', ...params );
	}

	private console_error( ...params: any[] ){
		window.console.error( 'meld-build', ...params );
	}

	private async file_log( prefix:string, ...params: any[] ){
		if (!this.file){
			return;
		}
		if ( params.length == 0 ){
			return;
		}

		let content = '';
		let isJson = false;
		if (
			params.length == 1
			&& typeof(params[0]) != 'object'
			&& typeof(params[0]) != 'function'
			&& typeof(params[0]) != 'symbol'
		){
			content = params[0].toString();
		}else{
			isJson = true;
			content = JSON.stringify(params, null, '  ');
		}

		const fmtPrefix = prefix.length > 0 ? ` [${prefix}] ` : '';

		let logLine: string;
		if ( isJson ){
			logLine = '```json\n'
				+ fmtPrefix.trim() + '\n'
				+ content + '\n```'
			;
		} else if (content.contains('\n')){
			// multiline
			logLine = '```\n' + fmtPrefix + content + '\n```';
		}else{
			// single line
			logLine = '`' + (fmtPrefix + content).trim() + '`';
		}

		logLine += '\n';

		await app.vault.append( this.file, logLine );
		
	}

	public async set_file( filename: string|undefined, clear = true ){
		if ( !filename ){
			this.file = undefined;
			return;
		}

		const filepath = Utils.getSameFolderFilepath(filename);

		const af = app.vault.getAbstractFileByPath(filepath);
		if ( af instanceof TFile ){
			this.file = af;
			if ( clear == true ){
				app.vault.modify( this.file, '' );
			}
		}else{
			this.file = await app.vault.create( filepath, '' );
		}
	}

	public async info( ...params: any[] ): Promise<void>{
		this.console_info( ...params );
		await this.file_log( 'info', ...params );
	}

	public async error( ...params: any[] ): Promise<void>{
		this.console_error( ...params );
		await this.file_log( 'error', ...params );
	}

}
