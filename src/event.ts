import { EventEmitter } from "events";
import { ClientInfo } from "./Whatsapp";
import { WAMessageUpdate, proto } from "@whiskeysockets/baileys";

const event = new EventEmitter();

export default event;


export interface EzWaEventEmitter {
    on<T extends keyof EzWaEventMap>(event: T, listener: (arg: EzWaEventMap[T]) => void): void;
    off<T extends keyof EzWaEventMap>(event: T, listener: (arg: EzWaEventMap[T]) => void): void;
    removeAllListeners<T extends keyof EzWaEventMap>(event: T): void;
    emit<T extends keyof EzWaEventMap>(event: T, arg: EzWaEventMap[T]): boolean;
}

export declare type EzWaEventMap = {
    'qr.update': {
        status: 'onscan' | 'stop' | 'expired';
        attempt: number;
        qrCode?: string;
        qrImage?: string;
        reason?: string;
    };
    'qr.stoped': {
        state: 'stoped' | 'expired';
        reason?: string;
    };

    'sock.connecting': {};
    'sock.connected': ClientInfo;
    'sock.stopped': {
        reason: string;
    };
    'sock.disconnected': {
        reason: string;
    };

    'msg.reaction': {};
    'msg.update': WAMessageUpdate;
    'msg.incoming': {
        message: proto.IWebMessageInfo, 
        messageData: {
            isGroup: boolean,
            phoneNumber: string,
            messageID: string,
            jid: string
        }
    };
}