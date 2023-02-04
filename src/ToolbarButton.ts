export class ToolbarButton {
	id: string;
	label?: string;
	params: string[];

	constructor(id: string, label?: string, params?: string[]) {
		this.id = id;
		this.label = label;
		this.params = params ?? [];
	}

	public static parse(line: string): ToolbarButton | null {
		const pair = line.split('=');
		if (pair.length == 2) {

			const buttonParts = pair[0].split('|').map(e => e.trim());
			const id = buttonParts.shift() ?? '';
			const params = buttonParts;

			const label = pair[1].trim();

			return new ToolbarButton(id, label, params);
		}
		return null;
	}
}
