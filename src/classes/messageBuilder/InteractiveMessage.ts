import { proto } from "@whiskeysockets/baileys";

export abstract class InteractiveMessage {

    abstract getPayload(): proto.Message.IInteractiveMessage
    
}