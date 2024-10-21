import { AnyMessageContent, isJidGroup, proto } from "@whiskeysockets/baileys";
import type Client from "../client";
import { isIfaceInteractiveMessage } from "../utils";

type ContextMessageContent = string|AnyMessageContent|proto.Message.IInteractiveMessage

export class MessageContext {
    readonly client: Client
    readonly msg: proto.IWebMessageInfo

    constructor(message: proto.IWebMessageInfo, ezWaClient: Client) {
        this.client = ezWaClient
        this.msg = message
    }

    get jid() {
        return this.msg.key.remoteJid || undefined;
    }

    private sendMsg(content: ContextMessageContent, options: {quoted?: proto.IWebMessageInfo} = {}) {
        if (typeof content === 'string') {
            content = { text: content }
        }

        if (isIfaceInteractiveMessage(content)) {
            return this.client.sendInteractiveMessage(this.jid!, content, {
                quoted: options.quoted
            })
        } else {
            return this.client.sendMessage(this.jid!, content, options.quoted)
        }
    }

    reply(content: ContextMessageContent) {
        return this.sendMsg(content, { quoted: this.msg })
    }
    
    send(content: ContextMessageContent) {
        return this.sendMsg(content)
    }

    isGroup() {
        return isJidGroup(this.jid)
    }

    simulateTyping(ms: number) {
        return this.client.simulateTyping(this.jid!, ms)
    }

    simulateRecording() {
        return this.client.simulateRecording(this.jid!)
    }
}