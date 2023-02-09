import { MarkdownView, Notice } from "obsidian";
import { AskModal } from "./modal-ask";
import { MessageModal } from "./modal-message";
import { TUiRunContext } from "./run-context";

export class UiRunContextImplementation implements TUiRunContext {

	notice(
		message: string | DocumentFragment,
		timeout?: number | undefined
	): void {
		new Notice( message, ( timeout ?? 5 ) * 1000 );
	}
	async rebuild(): Promise<void> {
		const view = app.workspace.getActiveViewOfType(MarkdownView);
		if (view == null){
			return;
		}
		await (view.leaf as any).rebuildView();
	}
	
	async message(
		titleOrMessage: string | number,
		message?: string | number | undefined
	): Promise<void> {
		const m = new MessageModal(app);

		let title: string;
		let msg: string;

		if (message == undefined){
			msg = titleOrMessage.toString();
			title = '';
		}else{
			title = titleOrMessage.toString();
			msg = message.toString();
		}

		await m.execute(title, msg);
	}
	
	async ask(
		titleOrQuestion: string,
		questionOrOptions?: string | string[] | undefined,
		options?: string[] | undefined
	): Promise<string | undefined> {
		const m = new AskModal(app);

		let finTitle: string;
		let finQuestion: string;
		let finOptions: string[];

		if ( questionOrOptions != undefined ){
			if ( typeof questionOrOptions == 'string' ){
				finTitle = titleOrQuestion;
				finQuestion = questionOrOptions;
				finOptions = options ?? [];
			}else {
				finTitle = '';
				finQuestion = titleOrQuestion;
				finOptions = questionOrOptions ?? [];
			}
		} else {
			finTitle = '';
			finQuestion = titleOrQuestion;
			finOptions = [];
		}

		await m.execute(
			finTitle,
			finQuestion,
			finOptions
		);
		return m.answer;
	}
}