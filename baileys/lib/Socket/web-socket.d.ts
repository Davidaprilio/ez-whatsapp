import { WebSocket as WS } from 'ws';
import { SocketConfig } from '../Types';
export declare class WebSocket extends WS {
    config: SocketConfig;
    constructor(config: SocketConfig);
    get isOpen(): boolean;
    get isClosed(): boolean;
    get isClosing(): boolean;
    get isConnecting(): boolean;
}
