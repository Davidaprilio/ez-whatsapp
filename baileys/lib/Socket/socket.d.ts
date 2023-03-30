/// <reference types="node" />
import { SocketConfig } from '../Types';
import { BinaryNode } from '../WABinary';
import { MobileSocket } from './mobile-socket';
import { WebSocket } from './web-socket';
/**
 * Connects to WA servers and performs:
 * - simple queries (no retry mechanism, wait for connection establishment)
 * - listen to messages and emit events
 * - query phone connection
 */
export declare const makeSocket: (config: SocketConfig) => {
    type: "md";
    ws: MobileSocket | WebSocket;
    ev: import("../Types").BaileysEventEmitter & {
        process(handler: (events: Partial<import("../Types").BaileysEventMap>) => void | Promise<void>): () => void;
        buffer(): void;
        createBufferedFunction<A extends any[], T>(work: (...args: A) => Promise<T>): (...args: A) => Promise<T>;
        flush(force?: boolean | undefined): boolean;
        isBuffering(): boolean;
    };
    authState: {
        creds: import("../Types").AuthenticationCreds;
        keys: import("../Types").SignalKeyStoreWithTransaction;
    };
    readonly user: import("../Types").Contact | undefined;
    generateMessageTag: () => string;
    query: (node: BinaryNode, timeoutMs?: number | undefined) => Promise<BinaryNode>;
    waitForMessage: (msgId: string, timeoutMs?: number | undefined) => Promise<any>;
    waitForSocketOpen: () => Promise<void>;
    sendRawMessage: (data: Uint8Array | Buffer) => Promise<void>;
    sendNode: (frame: BinaryNode) => Promise<void>;
    logout: (msg?: string | undefined) => Promise<void>;
    end: (error: Error | undefined) => void;
    onUnexpectedError: (error: Error, msg: string) => void;
    uploadPreKeys: (count?: number) => Promise<void>;
    uploadPreKeysToServerIfRequired: () => Promise<void>;
    /** Waits for the connection to WA to reach a state */
    waitForConnectionUpdate: (check: (u: Partial<import("../Types").ConnectionState>) => boolean | undefined, timeoutMs?: number | undefined) => Promise<void>;
};
export declare type Socket = ReturnType<typeof makeSocket>;
