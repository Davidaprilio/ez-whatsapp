import { proto } from "@whiskeysockets/baileys";
import { InteractiveMessage } from "./InteractiveMessage";

export type ButtonType = 'cta_url' | 'cta_call' | 'cta_copy' | 'cta_reminder' | 'cta_cancel_reminder' | 'address_message' | 'send_location' | 'quick_reply';

export interface ICreateButtonMessage {
    title?: string,
    body: string|string[],
    footer?: string,
    buttons: {
        name: ButtonType,
        id: string,
        display_text: string
    }[]
}

export class CreateButtonMessage extends InteractiveMessage {
    private options: ICreateButtonMessage;

    constructor(options?: ICreateButtonMessage) {
        super()

        this.options = options ?? {
            body: '',
            buttons: []
        }
    }

    private renderText(text: string|null|undefined) {
        if (text) return text
        return undefined
    }

    setTitle(text?: string) {
        this.options.title = text 
        return this
    }

    setFooter(text?: string) {
        this.options.footer = text
        return this
    }

    setBody(text: string|string[]) {
        this.options.body = text
        return this
    }

    addButton(type: ButtonType, options: Record<string, any>) {
        if (!this.options.buttons) {
            this.options.buttons = []
        }

        this.options.buttons.push({
            name: type,
            id: options.id,
            display_text: options.display_text
        })
        return this
    }
    
    addButtonReply(displayText: string, id?: string) {
        this.addButton('quick_reply', {
            id: id,
            display_text: displayText
        })
        return this
    }

    addButtonCopy(copyText: string, id?: string) {
        this.addButton('cta_copy', {
            id: id,
            copy_code: copyText
        })
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
                buttons: this.options.buttons.map<proto.Message.InteractiveMessage.NativeFlowMessage.INativeFlowButton>(btn => {
                    return proto.Message.InteractiveMessage.NativeFlowMessage.NativeFlowButton.create({
                        name: btn.name,
                        buttonParamsJson: JSON.stringify(btn)
                    })  
                })
            }
        }

        return proto.Message.InteractiveMessage.create(payload)
    }
}