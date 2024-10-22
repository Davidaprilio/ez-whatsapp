import { proto } from "@whiskeysockets/baileys";
import { InteractiveMessage } from "./InteractiveMessage";
import { IButtonParams, IButtonProps } from "../../misc/types";
import { createObjectButtonMessage } from "../../misc/utils";

export interface IOptionButtonMessage {
    title?: string,
    body: string|string[],
    footer?: string,
    buttons: IButtonProps[]
}

export class ButtonMessage extends InteractiveMessage {
    private options: IOptionButtonMessage;

    constructor(options?: IOptionButtonMessage) {
        super()

        this.options = options ?? {
            body: '',
            buttons: []
        }
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

    addButton<T extends keyof IButtonParams>(type: T, options: IButtonParams[T]): ButtonMessage {
        if (!this.options.buttons) {
            this.options.buttons = []
        }

        this.options.buttons.push(createObjectButtonMessage(type, options))
        return this
    }

    private generateId(id?: string) {
        return id ?? (this.options.buttons.length + 1).toString()
    }
    
    addButtonReply(displayText: string, id?: string) {
        this.addButton('quick_reply', {
            id: this.generateId(id),
            display_text: displayText
        })
        return this
    }

    addButtonCopy(copyText: string, id?: string) {
        this.addButton('cta_copy', {
            id: this.generateId(id),
            copy_code: copyText
        })
        return this
    }

    addButtonUrl(url: string, id?: string) {
        this.addButton('cta_url', {
            id: this.generateId(id),
            url
        })
        return this
    }

    /**
     * @param phoneNumber include country code
     */
    addButtonCall(phoneNumber: string, id?: string) {
        this.addButton('cta_call', {
            id: this.generateId(id),
            call: phoneNumber
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