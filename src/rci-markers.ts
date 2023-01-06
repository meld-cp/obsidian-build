import { TFile } from "obsidian";
import { MarkerChange, MarkerValue, TMarkerRunContext } from "./run-context";
import { RunLogger } from "./run-logger";

export class MarkerRunContextImplemention implements TMarkerRunContext {
	
	private markerStartPrefix = '%%';
	private markerStartSuffix = '=%%';
	
	private markerEndPrefix = '%%=';
	private markerEndSuffix = '%%'


	private log: RunLogger;
	
	private currentPath: string;
	private targetPath: string;

	private newValues = new Map<string,string|null>();

	constructor( log: RunLogger, currentPath:string ){
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

	set( name: string, value: any ): void {
		this.newValues.set( name, value );
	}

	private getTargetFileOrThrow(): TFile{
		const targetFile = app.vault.getAbstractFileByPath( this.targetPath );

		if (!(targetFile instanceof TFile)){
			throw new Error(`Target file path was not found. '${this.targetPath}'`);
		}
		return targetFile;
	}

	private async getTargetContents() : Promise<string>{
		const targetFile = this.getTargetFileOrThrow();
		return await app.vault.read( targetFile );
	}

	async fetch(): Promise<MarkerValue[]> {
		const content = await this.getTargetContents();
		return this.findMarkers( content );
	}

	private findMarkers( text:string ): MarkerValue[]{
		// build marker match rgex
		const exp = this.escapeRegex(this.markerStartPrefix)
			+ '(.*)' // marker name start
			+ this.escapeRegex(this.markerStartSuffix)
			+ '(\n?.*\n?)' // marker value
			+ this.escapeRegex(this.markerEndPrefix)
			+ '(.*)' // marker name end
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

	async apply( keepUnknownMarkers?:boolean ): Promise<MarkerChange[]> {
		let targetFileContent = await this.getTargetContents();
		const markers = this.findMarkers( targetFileContent );

		if ( keepUnknownMarkers != true ){
			for (const marker of markers) {
				if (this.newValues.has(marker.name)){
					continue;
				}
				this.newValues.set( marker.name, null );
			}
		}

		const result : MarkerChange[] = [];

		for ( const key of this.newValues.keys() ) {
			const currentMarkers = markers.filter( e => e.name == key );
			if ( currentMarkers.length == 0 ){
				continue; // marker isn't in file
			}
			
			
			const newValue = this.newValues.get(key) ?? '';
			
			// build replacement regex
			const findExp = this.escapeRegex(this.markerStartPrefix + key + this.markerStartSuffix)
			+ '(\n?.*\n?)' // any old marker value
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
		
		await app.vault.modify( targetFile, targetFileContent );

		return result;
	}


}