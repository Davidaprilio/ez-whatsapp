"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocket = void 0;
const ws_1 = require("ws");
const Defaults_1 = require("../Defaults");
class WebSocket extends ws_1.WebSocket {
    constructor(config) {
        super(config.waWebSocketUrl, undefined, {
            origin: Defaults_1.DEFAULT_ORIGIN,
            headers: config.options.headers,
            handshakeTimeout: config.connectTimeoutMs,
            timeout: config.connectTimeoutMs,
            agent: config.agent,
        });
        this.config = config;
    }
    get isOpen() {
        return this.readyState === ws_1.WebSocket.OPEN;
    }
    get isClosed() {
        return this.readyState === ws_1.WebSocket.CLOSED;
    }
    get isClosing() {
        return this.readyState === ws_1.WebSocket.CLOSING;
    }
    get isConnecting() {
        return this.readyState === ws_1.WebSocket.CONNECTING;
    }
}
exports.WebSocket = WebSocket;
