import { proto } from "@whiskeysockets/baileys";
import { InteractiveMessage } from "./InteractiveMessage";

export interface IOptionListMessage {
    title?: string,
    body: string|string[],
    footer?: string,
    buttonDisplay: string
    sections: { title: string; rows: ISectionsRows[] }[]
}

export interface ISectionsRows {
    title: string;
    id: string;
    header?: string;
    description?: string;
}

export class ListMessage extends InteractiveMessage {
    private options: IOptionListMessage;

    constructor(options?: IOptionListMessage) {
        super()

        this.options = options ?? {
            body: '',
            buttonDisplay: 'Options',
            sections: []
        }
    }

    setFooter(text?: string) {
        this.options.footer = text
        return this
    }

    setBody(text: string|string[]) {
        this.options.body = text
        return this
    }
    
    setButton(text: string) {
        this.options.buttonDisplay = text
        return this
    }

    addSection(title: string, rows: ISectionsRows[]) {
        this.options.sections.push({ title, rows })
        return this
    }

    getPayload() {
        const payload: proto.Message.IInteractiveMessage = {
            body: proto.Message.InteractiveMessage.Body.create({
                text: Array.isArray(this.options.body) 
                    ? this.options.body.join('\n') 
                    : this.options.body
            }),
            nativeFlowMessage: {
                buttons: [
                    proto.Message.InteractiveMessage.NativeFlowMessage.NativeFlowButton.create({
                        name: 'single_select',
                        buttonParamsJson: JSON.stringify({
                            title: this.options.buttonDisplay,
                            sections: this.options.sections
                        })
                    })
                ]
            }
        }

        return proto.Message.InteractiveMessage.create(payload)
    }
}