import { TFile, Vault } from "obsidian";
import { MarkerChange, MarkerValue, TMarkerRunContext } from "./run-context";
import { RunLogger } from "./run-logger";

export class MarkerRunContextImplemention implements TMarkerRunContext {
	
	private markerStartPrefix = '%%';
	private markerStartSuffix = '=%%';
	
	private markerEndPrefix = '%%=';
	private markerEndSuffix = '%%'

	private markerValueRegEx = '((?>.|\n|\r)*)';
	
	private vault: Vault;
	private log: RunLogger;
	
	private currentPath: string;
	private targetPath: string;

	private newValues = new Map<string,string|null>();

	constructor( vault:Vault, log: RunLogger, currentPath:string ){
		this.vault = vault;
		this.log = log;
		this.currentPath = currentPath;
		this.targetPath = currentPath;
	}

	define_mark_start( prefix: string, suffix: string ): void {
		this.markerStartPrefix = prefix;
		this.markerStartSuffix = suffix;
	}

	define_mark_end( prefix: string, suffix: string ): void {
		this.markerEndPrefix = prefix;
		this.markerEndSuffix = suffix;
	}

	target_file( path?: string ): void {
		this.targetPath = path ?? this.currentPath;
	}

	clear(): void {
		this.newValues.clear();
	}

	async load() : Promise<void>{
		const markers = await this.fetch();
		markers.forEach(mk => {
			this.set(mk.name, mk.value);
		});
	}

	get( name: string ) : string|null|undefined {
		return this.newValues.get( name );
	}

	set( name: string, value: string|null ): void {
		this.newValues.set( name, value );
	}

	private getTargetFileOrThrow(): TFile{
		const targetFile = this.vault.getAbstractFileByPath( this.targetPath );

		if (!(targetFile instanceof TFile)){
			throw new Error(`Target file path was not found. '${this.targetPath}'`);
		}
		return targetFile;
	}

	private async getTargetContents() : Promise<string>{
		const targetFile = this.getTargetFileOrThrow();
		return await this.vault.read( targetFile );
	}

	async fetch(): Promise<MarkerValue[]> {
		const content = await this.getTargetContents();
		return this.findMarkers( content );
	}

	private findMarkers( text:string ): MarkerValue[]{
		// build marker match rgex
		const exp = this.escapeRegex(this.markerStartPrefix)
			+ '(.*?)' // marker name start
			+ this.escapeRegex(this.markerStartSuffix)
			+ this.markerValueRegEx // marker value
			+ this.escapeRegex(this.markerEndPrefix)
			+ '(.*?)' // marker name end
			+ this.escapeRegex(this.markerEndSuffix)
		;
		//console.debug({exp});
		const rgexp = new RegExp(exp, 'g');
		
		const matches = text.matchAll( rgexp );

		const result:MarkerValue[] = [];

		for (const match of matches) {
			//console.debug({match});
			if( match.index == undefined ){
				continue;
			}
			const pos = match.index;

			const nameStart = match.at(1);
			const value = match.at(2);
			const nameEnd = match.at(3);

			if ( nameStart == undefined || nameEnd == undefined ){
				continue;
			}

			if ( nameStart !== nameEnd ){
				continue;
			}

			result.push( new MarkerValue( pos, nameStart, value ?? '' ) );
		}
		return result;
	}
	
	private escapeRegex(text:string):string {
		return text.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
	}

	async apply( clearUnknownMarkerValues?:boolean ): Promise<MarkerChange[]> {
		let targetFileContent = await this.getTargetContents();
		const markers = this.findMarkers( targetFileContent );

		if ( clearUnknownMarkerValues !== false ){
			for ( const marker of markers ) {
				if ( this.newValues.has( marker.name ) ){
					continue;
				}
				//console.log('apply::clearing marker value', {marker});
				this.newValues.set( marker.name, '' );
			}
		}

		const result : MarkerChange[] = [];

		for ( const key of this.newValues.keys() ) {
			const currentMarkers = markers.filter( e => e.name == key );
			if ( currentMarkers.length == 0 ){
				//console.debug('apply::marker isn\'t in file',{key, markers, targetFileContent});
				continue; // marker isn't in file
			}
			
			const newValue = this.newValues.get(key) ?? '';
			
			// build replacement regex
			const findExp = this.escapeRegex(this.markerStartPrefix + key + this.markerStartSuffix)
				+ this.markerValueRegEx // any old marker value
				+ this.escapeRegex(this.markerEndPrefix + key +this.markerEndSuffix)
			;
			const replacement = `${this.markerStartPrefix}${key}${this.markerStartSuffix}${newValue}${this.markerEndPrefix}${key}${this.markerEndSuffix}`;
			
			//console.log({findExp, replacement, currentMarkers});
			
			const findRegex = new RegExp(findExp, 'g');
			
			targetFileContent = targetFileContent.replaceAll( findRegex, replacement );
			
			for (const marker of currentMarkers) {
				const change = new MarkerChange( marker.posIndex, marker.name, marker.value, newValue );
				result.push(change);
			}			

		}
		
		// apply change to target file
		//console.debug({targetFileContent});
		const targetFile = this.getTargetFileOrThrow();
		
		await this.vault.modify( targetFile, targetFileContent );

		return result;
	}


}
