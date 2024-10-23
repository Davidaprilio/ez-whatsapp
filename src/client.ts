import { Boom } from "@hapi/boom";
import makeWASocket, { AnyMediaMessageContent, AnyMessageContent, Browsers, ConnectionState, delay, DisconnectReason, fetchLatestBaileysVersion, generateWAMessageFromContent, isJidUser, makeCacheableSignalKeyStore, MediaGenerationOptions, MessageGenerationOptionsFromContent, prepareWAMessageMedia, proto, useMultiFileAuthState, WABrowserDescription, WASocket, WAVersion } from "@whiskeysockets/baileys";
import { pino, type Logger } from "@whiskeysockets/baileys/node_modules/pino";
import axios from "axios";
import EventEmitter from "events";
import fs from "fs";
import { EzWaEventMap } from "./event";
import { convertToJID, makeQrImage } from "./helper";
import { toJID } from "./misc/utils";

export interface IClientOptions {
    authDir: string
    // useMobile: boolean
    browser: WABrowserDescription
    logger: Logger 
    printQRInTerminal?: boolean
    qrTimeout?: number
    markOnlineOnConnect?: boolean
    syncFullHistory?: boolean,
    maxAttemptQR: number,

    clientId: string
    debug: boolean
    eventEmiter: EventEmitter
}

type ClientStateStatus =
    | "stoped"
    | "disconnected"
    | "connecting"
    | "scan_qr"
    | "connected";

/**
 * focuses on maintaining socket connections 
 * and simplifying actions on sockets
 * 
 */
export default class Client {
    private _sock?: WASocket
    private options: IClientOptions
    private saveCreds: any
    private _waVersion?: {
        version: WAVersion;
        isLatest: boolean;
    }
    private isStopedByUser: boolean = false;
    private _totalAttempedScanQR: number = 0;
    private _connectionLostCount: number = 0;

    protected logger: Logger
    protected _state: {
        connection: ClientStateStatus
        reason: string|null
        photoURL: string|null
    } = {
        connection: 'disconnected',
        reason: null,
        photoURL: null,
    };

    constructor(options: Partial<IClientOptions> = {}) {
        this.options = {
            ...options,
            clientId: options.clientId ?? 'default',
            debug: options.debug ?? false,
            authDir: `${options.authDir ?? '.auth-states'}/${options.clientId ?? 'default'}`,
            browser: options.browser ?? Browsers.ubuntu('Chrome'),
            logger: options.logger ?? pino(),
            maxAttemptQR: options.maxAttemptQR ?? 4,
            syncFullHistory: options.syncFullHistory ?? false,
            eventEmiter: options.eventEmiter ?? new EventEmitter()
        }

        // Set Logger
        if (options.logger == undefined) {
            this.options.logger.level = this.options.debug ? "debug": "silent";
        }
        this.logger = this.options.logger
    }

    get sock(): WASocket {
        if (this._sock === undefined) {
            throw Error('WA Sock Missing')
        }
        return this._sock
    }
    
    get ev(): EventEmitter {
        return this.options.eventEmiter
    }
    
    get authStateDir() {
        return this.options.authDir + "/state"
    }
    
    get authAssetDir() {
        return this.options.authDir + "/assets"
    }
    
    get state() {
        return this._state
    }

    get isConnected() {
        return this.state.connection === 'connected'
    }
    
    get user() {
        return this.sock.user
    }

    get jid() {
        return this.user?.id
    }

    async getWAVersion() {
        if (this._waVersion) return this._waVersion

        const { version, isLatest } = await fetchLatestBaileysVersion();
        this._waVersion = { version, isLatest }

        // const { version, isLatest } = await this.fetchWAwebVersion();
        // this._waVersion = { version, isLatest }
        
        this.logger.debug(this._waVersion, "WA Version")
        return this._waVersion
    }

    async fetchWAwebVersion() {
        let version: {
            version: WAVersion
            isLatest: boolean
        }
        try {
            const res = await axios.get("https://web.whatsapp.com/check-update?version=1&platform=web");
            const data = res.data;
            
            version = { 
                version: (data.currentVersion as string).split(".").map(Number) as WAVersion, 
                isLatest: true 
            }
        } catch {
            version = {
                version: [2, 2413, 51],
                isLatest: false
            }
        }
        return version
    }

    /**
     * waiting until sock connected (Logged)
     */
    async waitSockConnected() {
        await this.sock.waitForSocketOpen()
        await this.sock.waitForConnectionUpdate(connState => connState.connection === 'open')
        return this.sock.user!
    }
    
    /**
     * waiting until sock disconnected (Stopped)
     */
    async waitSockStopped() {
        return new Promise(async resolve => {
            if (this.sock.ws.isClosed) return resolve(true)
            await delay(300)
        })
    }

    async startSock(): Promise<WASocket> {
        if (this.isConnected) {
            this.logger.debug(`client ${this.options.clientId} already connected`);
            return this.sock;
        }

        await this.createSock();
        await this.sock.waitForSocketOpen();

        return this.sock;
    };

    /**
     * Only stop socket connection without logged out
     */
    async stopSock() {
        this.isStopedByUser = true; // Set StopByUser true agar tidak di Reconnect oleh connectionUpdate()
        // this.setStatusDeviceDeactive();
        await this.sock.ws.close();
    }

    /**
     * Hook when Socket has been Created
     */
    protected whenSocketCreated() {}

    protected createEvenListener() {
        this.onConnectionUpdate()
        this.onCredsUpdate()
        this.whenSocketCreated()
    }

    private async createSock() {
        // memulihkan session sebelumnya jika dulu disimpan
        const { version } = await this.getWAVersion()
        const { state, saveCreds } = await useMultiFileAuthState(this.authStateDir);
        this.saveCreds = saveCreds;

        // const isShowQRinTerminal = this.pairing.mode === 'qr' ? this.options.printQRInTerminal : false
        const isShowQRinTerminal = this.options.printQRInTerminal
        try {
            this._sock = makeWASocket({
                version,
                logger: this.options.logger,
                browser: this.options.browser,
                printQRInTerminal: isShowQRinTerminal,
                qrTimeout: this.options.qrTimeout,
                markOnlineOnConnect: this.options.markOnlineOnConnect,
                // mobile: this.options.useMobile,
                // auth: state,
                auth: {
                    creds: state.creds,
                    /** caching makes the store faster to send/recv messages */
                    keys: makeCacheableSignalKeyStore(state.keys, this.logger),
                },
                // getMessage: async (key: { remoteJid: any; id: any; }) => {
                //     if(this.store) { 
                //         const msg = await this.store.loadMessage(key.remoteJid!, key.id!) 
                //         return msg?.message || undefined 
                //     } 
                 
                //     // only if store is present 
                //     return proto.Message.fromObject({}) 
                // },
                syncFullHistory: this.options.syncFullHistory
            })

            this.createEvenListener()
            this.sock.ev.emit('asasas' as any, () => {

            })
        } catch (error) {
            this.logger.error("Socket Error:", error);
        }
        return this.sock;
    }

    protected onCredsUpdate() {
        this.sock?.ev.on("creds.update", this.saveCreds);
    }

    protected onSocketLogoutAction() {
        this.logger.debug("socket logged out")
        this.removeAuthStateDir();
        this._state.reason = "logged_out"
        this.emit('sock.disconnected', {
            reason: this._state.reason,
        })
    }

    protected removeAuthStateDir(safeAsset: boolean = false) {
        if (safeAsset) {
            if (fs.existsSync(this.authStateDir)) {
                fs.rmSync(this.authStateDir, { recursive: true });
            }
            return
        }

        if (fs.existsSync(this.options.authDir)) {
            fs.rmSync(this.options.authDir, { recursive: true });
        }
    }

    protected async onQrUpdate(codeQR: string) {
        if (this.options.maxAttemptQR) {
            if (this._totalAttempedScanQR >= this.options.maxAttemptQR) {
                this.logger.debug(`stoped client because ${this.options.maxAttemptQR} times not scanning QRcode (not used)`);
                await this.stopSock();
            } else {
                this._totalAttempedScanQR++;
            }
        }
        
        this.emit('qr.update', {
            status: 'onscan',
            qrCode: codeQR,
            qrImage: await makeQrImage(codeQR),
            attempt: this._totalAttempedScanQR,
            remain: this.options.maxAttemptQR - this._totalAttempedScanQR,
        })
    }

    /**
     * Handle Connection Update
     *
     */
    protected onConnectionUpdate() {
        this.sock.ev.on('connection.update', (update: Partial<ConnectionState>) => {
            const { 
                connection, 
                lastDisconnect, 
                qr,
                receivedPendingNotifications,
            } = update;

            // QR Code Updated
            if (qr !== undefined) {
                this.onQrUpdate(qr)
                return
            }

            // Client Connected
            if (connection === "open") {
                // this.socketConnected()
                this.logger.debug("client connected")
                return
            }
            
            this.logger.debug({connection, lastDisconnect, update}, "connection update value");
            // Jika status device sudah di-Stop oleh user (bukan system reconnect), 
            // maka tidak perlu di reconnect lagi biarkan mati
            if (this.isStopedByUser) {
                this.logger.debug(`Sock "${this.options.clientId}" stoped by action (Safe Session)`);
                return
            }
            // Reconnect jika connection close (bukan dari user)
            else if (connection === "close") {
                if (lastDisconnect === undefined) {
                    this.logger.error(update, 'UNHANDLE CONNECTION CLOSE')
                    return
                }

                const err = (lastDisconnect.error as Boom).output;

                // Handle CODE:401 (Logged Out)
                if (err.statusCode === DisconnectReason.loggedOut) {
                    this.onSocketLogoutAction()
                    return
                }

                // Connection Gone (hilang/rusak) = stop and auto start in 10s
                if (err.statusCode === 410 || err?.payload.message === "Stream Errored") {
                    this.logger.info("Stream Errored", err.payload);
                    try {
                        this.stopSock();
                    } catch (error) {
                        this.logger.info("Stoped sock", error);
                    }
                    setTimeout(() => {
                        if (!this.isStopedByUser) {
                            this.startSock();
                        }
                    }, 10_000);
                    return;
                }
            
            
                if (err.statusCode === DisconnectReason.timedOut) {         
                    if(this._connectionLostCount > 20) {
                        this.logger.warn('NO INTERNET CONNECTION');
                        this.stopSock()
                    } else {
                        this._connectionLostCount++
                        this.startSock();
                    }
                }
                // Masalah lainya
                else {
                    const msg = lastDisconnect.error?.message || 'UnknownError';
                    this.logger.error(lastDisconnect.error!, msg + ' | Socket closed can\'t found valid auth state')
                    this.startSock();
                }
            }
            else if (receivedPendingNotifications !== undefined) {
                /** has the device received all pending notifications while it was offline */
            }
            // Status Tidak dikenali
            else {
                this.logger.debug(`Open {else} ${connection} - Status Tidak dikenali`);
                this.logger.debug(update);

                if (connection == "connecting") {
                    // this.info.status = "connecting";
                }
            }

            // only connection update will be emit
            // if (["open", "connecting", "close"].includes(connection)) {
            //     // check current connection is equal old connection, if equal not emit
            //     if (connection === this.info.status) {
            //         this.logger.info("Emit closed but it's still the same connection");
            //         return;
            //     }

            //     if (connection === 'connecting') {
            //         this.status = connection
            //         this.info.status = connection
            //         this.emit('sock.connecting', {

            //         })
            //     }
            // }
        })
    }

    /**
     * Checking Phone Number is Registration on Whatsapp
     * @return JID string or false
     *  
     */
    async isRegistedWA(numberPhone: string): Promise<string|false> {
        const jid = convertToJID(numberPhone);
        let res = await this.sock.onWhatsApp(jid);
        return res[0]?.exists ? jid : false;
    }

    async simulateTyping(toJid: string, timeMs: number) {
        await this.sock.sendPresenceUpdate('composing', toJid)
        await delay(timeMs); // ms
        await this.sock.sendPresenceUpdate("paused", toJid);
    }

    simulateRecording(toJid: string) {
        return this.sock.sendPresenceUpdate('recording', toJid);
    }

    prepareWAMessageMedia(message: AnyMediaMessageContent, options?: Omit<MediaGenerationOptions,'upload'>) {
        return prepareWAMessageMedia(message, {
            ...options,
            upload: this.sock.waUploadToServer
        })
    }

    /**
     * specifically for sending interactive messages
     * eg: button | list | slider 
     */
    async sendInteractiveMessage(
        jid: string, 
        content: proto.Message.IInteractiveMessage, 
        options: Partial<MessageGenerationOptionsFromContent> & {
            typingTimeMs?: number
        } = {}
    ) {
        // let typingTimeMs
        let { typingTimeMs, ...option} = options
    
        let msg = generateWAMessageFromContent(jid, {
            viewOnceMessage: {
                message: {
                    messageContextInfo: {
                        deviceListMetadata: {},
                        deviceListMetadataVersion: 2
                    },
                    interactiveMessage: (content instanceof proto.Message.InteractiveMessage) ? content : proto.Message.InteractiveMessage.create(content)
                }
            }
        }, option as MessageGenerationOptionsFromContent)

        if (typingTimeMs) {
            await this.simulateTyping(jid, typingTimeMs)
        }

        return await this.sock.relayMessage(jid, msg.message as any, {
            messageId: msg.key.id as any
        });
    }

    replayInteractiveMessage(quoted: proto.IWebMessageInfo, content: proto.Message.IInteractiveMessage) {
        return this.sendInteractiveMessage(quoted.key.remoteJid!, content, {
            quoted
        })
    }

    /**
     * 
     * @param jid jid or phone number
     * @returns 
     */
    async sendMessage(
        jidOrPhoneNumber: string,
        msg: AnyMessageContent,
        replayMsg?: proto.IWebMessageInfo,
        msTimeTyping?: number
    ) {
        try { 
            let jid: string|false = jidOrPhoneNumber

            if (!jidOrPhoneNumber.includes('@')) {
                jid = toJID(jidOrPhoneNumber)
            }

            if (isJidUser(jidOrPhoneNumber)) {
                jid = await this.isRegistedWA(jidOrPhoneNumber)
                if (jid === false) {
                    return {
                        status: false,
                        error: true,
                        message: "phone number is not registered",
                        response: null,
                        err: 'phone.not_registered'
                    }
                }
            }
        
            if (msTimeTyping) {
                await this.sock.presenceSubscribe(jid)
                await this.simulateTyping(jid, msTimeTyping)
            }

            const quotedMsg = replayMsg ? { quoted: replayMsg } : replayMsg;
            return await this.sock.sendMessage(jid, msg, quotedMsg);
        } catch (error) {
            const err = (error as Boom);
            return {
                status: false,
                error: true,
                message: "failed to send message",
                response: err?.output.payload ?? err,
                err: err.message,
            };
        }
    };


    replyMessage(quoted: proto.IWebMessageInfo, content: AnyMessageContent) {
        return this.sock.sendMessage(quoted.key.remoteJid!, content, { quoted });
    }
    


    // add event listener
    on<T extends keyof EzWaEventMap>(event: T, listener: (arg: EzWaEventMap[T]) => void): void {
        this.ev.on(event, listener)
    }

    off<T extends keyof EzWaEventMap>(event: T, listener: (arg: EzWaEventMap[T]) => void): void {
        this.ev.off(event, listener)
    }

    removeAllListeners<T extends keyof EzWaEventMap>(event: T): void {
        this.ev.removeAllListeners(event)
    }

    emit<T extends keyof EzWaEventMap>(event: T, arg: EzWaEventMap[T]): boolean {
        return this.ev.emit(event, arg)
    }

    once<T extends keyof EzWaEventMap>(event: T, listener: (arg: EzWaEventMap[T]) => void): void {
        this.ev.once(event, listener)
    }
}