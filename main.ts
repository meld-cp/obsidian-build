import { Editor, MarkdownView, moment, Plugin } from 'obsidian';
import * as HB from  'handlebars';
import { RunLogger } from 'src/run-logger';
import { Compiler } from 'src/compiler';

HB.registerHelper('format_number', function (value, options) {
    // Helper parameters
    const dp = parseInt( options.hash['decimal_places'] ) || parseInt( options.hash['dp'] ) || 2;

	// Parse to float
    value = parseFloat(value);

    // Returns the formatted number
    return value.toFixed(dp);
});

HB.registerHelper('format_date', function (value, options) {
    // Helper parameters
    const pattern = options.hash['pattern'] as string || 'yyyy-MM-dd';

	// Returns the formatted date
	return moment(value).format(pattern);
});

//HB.registerHelper('data_uri', function (value, options) {
	//TODO
    // Helper parameters
    //const file = options.hash['file'] as string;
	//const contentType = options.hash['content_type'] as string;

	// check if file exists
	// convert file to data uri
	
//});


interface MeldBuildPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MeldBuildPluginSettings = {
	mySetting: 'default'
}

export default class MeldBuildPlugin extends Plugin {
	settings: MeldBuildPluginSettings;

	async onload() {
		await this.loadSettings();

		// try {
		// 	this.registerExtensions(['html'], 'meld-build-html-view');
		// } catch (error) {
		// 	new Notice(error);
		// 	//await showError(`File extensions ${HTML_FILE_EXTENSIONS} had been registered by other plugin!`);
		// }

		this.addCommand({
			id: 'meld-build-run',
			name: 'Run',
			editorCallback: async (editor: Editor, view: MarkdownView) => {
				const logger = new RunLogger();
				try{
					//await view.save();
					const compiler = new Compiler();
					const runner = compiler.compile(logger, editor, view);
					runner();
				}catch(e){
					logger.error(e)
				}
			}
		});

	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}