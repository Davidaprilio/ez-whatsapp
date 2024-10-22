import { prepareWAMessageMedia, proto, WASocket } from "@whiskeysockets/baileys";
import { InteractiveMessage } from "./InteractiveMessage";
import { IButtonProps } from "../../misc/types";
import { createInteractiveMessageContent } from "../../misc/utils";

export interface IOptionCaroselMessage {
    title?: string,
    body: string|string[],
    footer?: string,
    cards: proto.Message.IInteractiveMessage[]
}


export interface ICaroselCard {
    header: {
        title?: string,
        image: string|proto.Message
    }, 
    body?: string, 
    footer?: string,
    button: IButtonProps
}

export class CaroselMessage extends InteractiveMessage {
    private options: IOptionCaroselMessage
    private readonly sock: WASocket

    constructor(sock: WASocket, options?: IOptionCaroselMessage) {
        super()

        this.sock = sock
        this.options = options ?? {
            body: '',
            cards: []
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

    async addCard(props: ICaroselCard) {
        let mediaContent: proto.Message
        if (typeof props.header.image === 'string') {
            mediaContent = await prepareWAMessageMedia({
                image: {
                    url: props.header.image
                }
            }, { upload: this.sock.waUploadToServer })
        } else {
            mediaContent = props.header.image
        }

        const card = createInteractiveMessageContent({
            body: props.body,
            footer: props.footer,
            nativeFlowMessage: {
                buttons: [ props.button ]
            }
        }, mediaContent)
        
        this.options.cards.push(card)
        
        return this
    }

    getPayload() {
        return createInteractiveMessageContent({
            title: this.options.title,
            body: Array.isArray(this.options.body) ? this.options.body.join('\n') : this.options.body,
            carouselMessage: {
                cards: this.options.cards
            }
        })
    }
}