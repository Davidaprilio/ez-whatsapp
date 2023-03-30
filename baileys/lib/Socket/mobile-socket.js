"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MobileSocket = void 0;
const net_1 = require("net");
const Defaults_1 = require("../Defaults");
class MobileSocket extends net_1.Socket {
    constructor(config) {
        super();
        this.config = config;
        if (config.auth.creds.registered) {
            this.connect();
        }
        this.on('data', (d) => {
            this.emit('message', d);
        });
    }
    connect() {
        return super.connect(Defaults_1.MOBILE_PORT, Defaults_1.MOBILE_ENDPOINT, () => {
            this.emit('open');
        });
    }
    get isOpen() {
        return this.readyState === 'open';
    }
    get isClosed() {
        return this.readyState === 'closed';
    }
    get isClosing() {
        return this.isClosed;
    }
    get isConnecting() {
        return this.readyState === 'opening';
    }
    close() {
        this.end();
    }
    send(data, cb) {
        return super.write(data, cb);
    }
}
exports.MobileSocket = MobileSocket;