import { Boom } from "@hapi/boom";
import fs from "fs";
import { writeFile } from 'fs/promises'
import PinoLog from "./logger/pino";
import mime from "mime-types";
import parsePhoneNumber from 'libphonenumber-js'

import makeWASocket, {
    AnyMessageContent,
    delay,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeInMemoryStore,
    ConnectionState,
    Browsers,
    useMultiFileAuthState,
    WAMessage,
    MessageUpsertType,
    proto,
    isJidGroup,
    WASocket,
    downloadMediaMessage,
    PHONENUMBER_MCC,
    makeCacheableSignalKeyStore,
} from "@whiskeysockets/baileys";
declare type MakeInMemoryStore = ReturnType<typeof makeInMemoryStore>;

import { convertToJID, jidToNumberPhone, makeQrImage } from "./helper";

import Message from "./message/index";
import { Logger } from "pino";
import { EventEmitter } from "events";
import { EzWaEventEmitter, EzWaEventMap } from "./event";

export enum Client {
    Chrome = 'Chrome',
    Firefox = 'Firefox',
    Safari = 'Safari',
    Edge = 'Edge',
    Opera = 'Opera',
    Desktop = 'Desktop'
}

type TCodeMCC = keyof typeof PHONENUMBER_MCC

type ClientStatus =
    | "stoped"
    | "disconnected"
    | "connecting"
    | "scan QR"
    | "connected";

type MessageUpsert = {
    messages: WAMessage[], 
    type: MessageUpsertType
}

interface WhatsappOption {
    useMobile: boolean,
    mobilePhone: string | null,
    useStore: boolean,
    browser: string | Client | [string,string,string],
    showQRinTerminal: boolean,
    hostname: string | null,
    silentLog: boolean,
    pathSession: string,
    maxQrScanAttempts: number,
}

type PairingOption = {
    mode: "qr",
    phone: undefined
} | {
    mode: "code",
    phone: string
} | {
    mode: "mobile",
    phone: string
}

export interface ClientInfo {
    id: string;
    hostname: string | null;
    authPath: string;
    status: ClientStatus;
    isAuth: boolean; // Cek sudah terauthentikasi apa belum
    qrCode: string | null; // hanya di-isi dengan qrcode active
    ppURL: string | null; // Profile Picture URL Whatsapp
    pushName: string | null; // name Whatsapp
    phoneNumber: string | null; // phone number Whatsapp
    jid: string | null; // id number from Whatsapp
    browser: [string, string, string]; // [host, browser, version]
    connectedAt: string | null;
    more?: any;
}

export default class Whatsapp implements EzWaEventEmitter {
    info: ClientInfo;
    private _sock: WASocket; // Socket dari makeWALegacySocket | makeWASocket
    private status: string;
    private saveState: any;
    private connectionLostCount: number = 0; // jumlah koneksi timeout 
    private store: MakeInMemoryStore | undefined;
    readonly logger: Logger;
    private isStopedByUser: boolean = false;
    private _attemptQRcode: number = 0;
    readonly options: WhatsappOption = {
        hostname: null,
        showQRinTerminal: true,
        browser: Client.Chrome,
        silentLog: true,
        useStore: false,
        useMobile: false,
        mobilePhone: null,
        maxQrScanAttempts: 5,
        pathSession: '.session',
    };

    private pairing: PairingOption = {
        mode: 'qr',
        phone: undefined,
    }

    event: EventEmitter;

    get sock(): WASocket {
        return this._sock
    }

    get attemptQRcode(): number {
        return this._attemptQRcode
    }

    get getStore(): MakeInMemoryStore|undefined {
        return this.store
    }

    constructor(
        sessionId?: string | null,
        moreOptions?: Partial<WhatsappOption>
    ) {
        this.options = { ...this.options, ...moreOptions }

        if (this.options.useMobile) {
            if (this.options.mobilePhone === null) {
                throw new Error("Please provide mobile phone number if useMobile set true");
            }

            // check validation phone
        }
        sessionId = sessionId || "ez-wa";
        const pathSession = `${this.options.pathSession}/auth-state/${sessionId}`;

        const browserSocket = Array.isArray(this.options.browser) ? this.options.browser : Browsers.appropriate(this.options.browser);
        // create name host
        if (this.options.hostname) {
            if (browserSocket[1] in Client) {
                browserSocket[0] = this.options.hostname
            } else {
                browserSocket[0] = `${browserSocket[1]}(${this.options.hostname})`
            }
        }

        this.info = {
            id: sessionId,
            hostname: this.options.hostname,
            authPath: pathSession,
            ppURL: null,
            pushName: null,
            phoneNumber: null,
            jid: null,
            browser: browserSocket,
            connectedAt: null,
            status: "disconnected",
            isAuth: false,
            qrCode: null,
        };

        // make Logger
        this.logger = PinoLog.child({});
        this.logger.level = this.options.silentLog ? "silent" : "debug";  

        if (this.options.useStore) {
            // buat path untuk simpan auth session
            if (!fs.existsSync(pathSession)) fs.mkdirSync(pathSession, { recursive: true });

            // untuk menyimpan data socket, session, chat dll
            this.store = makeInMemoryStore({
                logger: this.logger,
            });
            this.store.readFromFile(pathSession + '/ezwa_store.json')
            // save every 10s
            const intervalStore = setInterval(() => {
                try {
                    this.store!.writeToFile(pathSession+'/ezwa_store.json')
                } catch (error) {
                    if (error instanceof Error && error.message.includes("No such file or directory")) {
                        clearInterval(intervalStore)
                    }
                }
            }, 10_000)
        }

        this.event = new EventEmitter();
    }

    startSock = async ():Promise<WASocket> => {
        if (this.status == "active") {
            this.logger.info(`Client ${this.info.id} already connected`);
            return this.sock;
        }

        // buat sock dari client yang diberikan
        await this.createSock();

        this.store?.bind(this.sock.ev);
        this.createEvenListener()

        await this.sock.waitForSocketOpen();
        if (this.pairing.mode === 'code' && !this.sock.authState.creds.registered) {
            await delay(10_000)
            const code = await this.requestPairingCode()
            this.logger.info(`Pairing code: ${code}`)
            if (code) {
                this.emit('pair-code.update', code)
            } 
        }
        return this.sock;
    };

    private createEvenListener() {
		// Pesan masuk
        this.sock.ev.on("messages.upsert", async ({ messages, type }: MessageUpsert) => {
            
            // notify => notify the user, this message was just received
            // append => append the message to the chat history, no notification required
            if (type === "append" || type === "notify") {
                const msg = messages[0];
                if (msg === undefined) return;

                const { key } = msg;
                
                if (key.fromMe == false) {
                    const { id: messageID, remoteJid: jid } = key
                    const phone = jidToNumberPhone(jid || '');
                    const isGroup = isJidGroup(jid || undefined) || false;
                    
                    this.incomingMessage(msg, {
                        isGroup,
                        phoneNumber: phone,
                        messageID,
                        jid,
                    })
                }
            } else {
                this.logger.info("Incoming Message unknown Type: ", type, messages);
            }
        });

        // Perubahan Pesan
        this.sock.ev.on("messages.update", (msgsUpdate) => {
            this.logger.info("===============  messages.update  ================");
            this.logger.info(JSON.stringify(msgsUpdate, undefined, 2));
            this.emit('msg.update', msgsUpdate[0]!)
        });

        // State Update Online|Offline

        this.sock.ev.on("connection.update", (update: any) => {
            this.connectionUpdate(update);
        });

        // listen for when the auth credentials is updated
        this.sock.ev.on("creds.update", this.saveState);

        this.sock.ev.on("messages.reaction", (arg: { key: proto.IMessageKey; reaction: proto.IReaction; }[]) => {
            this.logger.info("Reaction", arg)
            this.emit('msg.reaction', {})
        });
	}

    incomingMessage(message: proto.IWebMessageInfo, messageData: any) {
        this.emit('msg.incoming', {
            message,
            messageData
        })       
    }

    /**
     * Membuat Sock Client
     *
     * Perlu Mengisi this.info.multiDevice ke true
     * terlibih dahulu jika ingin menggunakan multi device
     *
     * @param host: Browser Host name
     * @param browser: Browser Type  Chrome(default)|Firefox|Safari|Custom name
     * @param browserVerison: Browser Version 22.14(default)
     * @param multiDevice: Mode Client Legacy|MultiDevice(default)
     * @returns Object
     */
    private async createSock() {
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`====================== Whatsapp API ======================`);
        console.log(` Using WA v${version.join(".")} | isLatest: ${isLatest} | cid: ${this.info.id}`);
        console.log("==========================================================");

        // memulihkan session sebelumnya jika dulu disimpan
        const { state, saveCreds } = await useMultiFileAuthState(this.info.authPath);
        this.saveState = saveCreds;

        const isShowQRinTerminal = this.pairing.mode === 'qr' ? this.options.showQRinTerminal : false
        try {
            const conn = makeWASocket({
                version,
                logger: this.logger,
                browser: this.info.browser,
                printQRInTerminal: isShowQRinTerminal,
                mobile: this.options.useMobile,
                // auth: state,
                auth: {
                    creds: state.creds,
                    /** caching makes the store faster to send/recv messages */
                    keys: makeCacheableSignalKeyStore(state.keys, this.logger),
                },
                getMessage: async (key) => {
                    if(this.store) { 
                        const msg = await this.store.loadMessage(key.remoteJid!, key.id!) 
                        return msg?.message || undefined 
                    } 
                 
                    // only if store is present 
                    return proto.Message.fromObject({}) 
                },
                syncFullHistory: true,
            })
            this._sock = conn;
        } catch (error) {
            this.logger.info("Socket Error:", error);
        }
        return this.sock;
    }

    /**
     * Handle Connection Update
     *
     */
    private connectionUpdate(update: ConnectionState) {
        const { 
            connection, 
            lastDisconnect, 
            qr,
            receivedPendingNotifications,
        } = update;
        this.logger.info("connection update: ", connection, lastDisconnect, update);

        // Jika status device sudah di-Stop oleh user (bukan system reconnect), 
        // maka tidak perlu di reconnect lagi biarkan mati
        if (this.isStopedByUser) {
            this.logger.info(`Device ${this.info.id} Stoped by user (Safe Session)`);
            this.info.status = "stoped";
            this.emit('sock.stopped', {
                reason: "stoped_by_user",
            })
        }
        // Reconnect jika connection close (bukan dari user)
        else if (connection === "close") {
            this.info.status = "connecting";
            if (lastDisconnect) {
                const err = (lastDisconnect.error as Boom).output;
                // Connection Gone (hilang/rusak)
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
                // Handle If Logout CODE:401
                else if (err.statusCode === DisconnectReason.loggedOut) {
                    this.socketLogout()
                }
                // Request Time-out (no-internet)
                else if (err.statusCode === DisconnectReason.timedOut) {         
                    if(this.connectionLostCount > 20) {
                        this.logger.warn('NO INTERNET CONNECTION');
                        this.stopSock()
                    } else {
                        this.connectionLostCount++
                        this.startSock();
                    }
                }
                // Masalah lainya
                else {
                    const msg = lastDisconnect.error?.message || 'No Error';
                    this.logger.error(lastDisconnect.error!, msg + ' SOCKET CLOSED +++++++++++++++++++++++++++++')
                    this.startSock();
                }
            } else {
                this.logger.error(update, 'UNHANDLE CONNECTION CLOSE')
            }
        }
        // Client Connected Horeee !!!
        else if (connection === "open") {
            this.socketConnected()
        }
        // New QR Code
        else if (qr !== undefined) {
            // the current QR code
            this.socketScanQR(qr)
        }
        else if (receivedPendingNotifications !== undefined) {
            /** has the device received all pending notifications while it was offline */
        }
        // Status Tidak dikenali
        else {
            this.logger.info(`Open {else} ${connection} - Status Tidak dikenali`, update);
            if (connection == "connecting") {
                this.info.status = "connecting";
            }
        }

        // only connection update will be emit
        if (["open", "connecting", "close"].includes(connection)) {
            // check current connection is equal old connection, if equal not emit
            if (connection === this.info.status) {
                this.logger.info("Emit closed but it's still the same connection");
                return;
            }

            if (connection === 'connecting') {
                this.status = connection
                this.info.status = connection
                this.emit('sock.connecting', {

                })
            }
        }
    }



    // Event Handler
    private socketConnected() {
        this.logger.info("Connection Open");
        this._attemptQRcode = 0;
        this.setStatusDeviceActive();
        this.info.qrCode = null;
        this.info.isAuth = true;
        this.info.connectedAt = new Date().toDateString();

        this.info.jid = this.sock.user?.id || null;
        this.info.pushName = this.sock.user?.name || null;

        this.getProfilePicture(true);
        if (this.info.jid !== null) {
            this.info.phoneNumber = jidToNumberPhone(this.info.jid);
        }
        this.emit('sock.connected', this.info) 
    }

    private async socketScanQR(codeQR: string) {
        this.logger.info("QR Code Update");
        if (this._attemptQRcode > this.options.maxQrScanAttempts) {
            this.logger.info("Stoped Device because 5x not scanning QRcode (not used)");
            await this.stopSock();
            this.emit('qr.stoped', {
                state: 'expired',
                reason: 'not_scanning',
            })
            return;
        } else {
            this._attemptQRcode++;
        }
        this.resetStatusClient();
        this.info.isAuth = false;
        this.info.qrCode = codeQR;
        this.info.status = "scan QR";
        this.emit('qr.update', {
            status: 'onscan',
            qrCode: codeQR,
            qrImage: await makeQrImage(codeQR),
            attempt: this._attemptQRcode,
        })
    }

    private socketLogout() {
        console.log("Client Is Logout");
        this.info.isAuth = false;
        this.info.status = "disconnected";
        this.setStatusDeviceDeactive();
        this.removeSessionPath();
        this.emit('sock.disconnected', {
            reason: 'Logout',
        })
    }
    // END: Event Handler


    /**
     * Only stop socket connection (safe socket credential)
     */
    async stopSock() {
        this.isStopedByUser = true; // Set StopByUser true agar tidak di Reconnect oleh connectionUpdate()
        this.setStatusDeviceDeactive();
        await this.sock.ws.close();
    }


    async login():Promise<WASocket> {
        this.info.status = 'connecting';
        this.isStopedByUser = false;
        return await this.startSock()
    }

    async logout() {
        await this.sock.logout()
    }

    /**
     * Handle Remove Session Path
     */
    private removeSessionPath() {
        if (fs.existsSync(this.info.authPath)) {
            fs.rmSync(this.info.authPath, { recursive: true });
        }
    }

    private setStatusDeviceDeactive() {
        this.status = "not connected";
        this.info.status = "disconnected";
    }
    private setStatusDeviceActive() {
        this.status = "connected";
        this.info.status = "connected";
    }
    private resetStatusClient(): void {
        this.info.jid = null;
        this.info.status = "disconnected";
        this.info.qrCode = null;
        this.info.pushName = null;
        this.info.phoneNumber = null;
    }

    /**
     * 
     * @param jid jid or phone number
     * @returns 
     */
    sendMessageWithTyping = async (
        jidOrPhone: string,
        msg: AnyMessageContent,
        replayMsg?: proto.IWebMessageInfo,
        msTimeTyping?: number
    ) => {
        const jidRegistered = await this.isRegistWA(jidOrPhone)
        if (jidRegistered === false) {
            return {
                status: false,
                error: true,
                message: "phone number is not registered",
                response: null,
                err: 'phone.not_registered'
            }
        }
        
        if (msTimeTyping) {
            await this.sock.presenceSubscribe(jidRegistered);
            await this.sock.sendPresenceUpdate("composing", jidRegistered);
            await delay(msTimeTyping); // ms
            await this.sock.sendPresenceUpdate("paused", jidRegistered);
        }

        const quotedMsg = replayMsg ? { quoted: replayMsg } : replayMsg;
        try {
            return await this.sock.sendMessage(jidRegistered, msg, quotedMsg);
        } catch (error) {
            const err = (error as Boom)?.output;
            return {
                status: false,
                error: true,
                message: "failed to send message",
                response: err?.payload ?? err,
                err: error.message,
            };
        }
    };

    /**
     * Checking Phone Number is Registration on Whatsapp
     * @return JID string or false
     *  
     */
    async isRegistWA(numberPhone: string): Promise<string|false> {
        const jid = convertToJID(numberPhone);
        let res = await this.sock.onWhatsApp(jid);
        return res[0]?.exists ? jid : false;
    }

    async statusContact(jid: string) {
        const status = await this.sock.fetchStatus(jid);
        return status;
    }

    async fetchProfilePicture(
        jid: string,
        highResolution = false
    ): Promise<string|null> {
        // image for high res picture
        // preview for low res picture
        return await this.sock.profilePictureUrl(
            jid, 
            highResolution ? "image" : "preview"
        ).catch(() => null) || null
    }

    createMessage(msTimeTyping?: number) {
        return new Message(this, msTimeTyping)
    }

    /**
    | =====================================================
    | Action from Whatsapp Socket
    | =====================================================
    |
    */
    async deleteMessage(jid: string, keyMessage: proto.IMessageKey) {
        await this.sock.sendMessage(jid, { delete: keyMessage })
    }

    // Block user
    async blockUser(jid: string) {
        await this.sock.updateBlockStatus(jid, "block")
    }
    // Unblock user
    async unblockUser(jid: string) {
        await this.sock.updateBlockStatus(jid, "unblock")
    }

    async getBusinessProfile(jid: string) {
        const profile = await this.sock.getBusinessProfile(jid)
        return profile
    }

    // Untuk mendapatkan kehadiran seseorang (jika mereka sedang mengetik atau online)
    async presenceSubscribe(jid: string) {
        await this.sock.presenceSubscribe(jid)
    }

    // To change your display picture or a group's
    async changeProfilePicture(jid: string, imageUrl: string) {
        await this.sock.updateProfilePicture(jid, { 
            url: imageUrl
        })
    }

    // To get the display picture of some person/group
    async getProfilePicture(highResolution = false): Promise<string|null> {
        if (this.info.jid) {
            this.info.ppURL = await this.fetchProfilePicture(this.info.jid, highResolution) || null;
            return this.info.ppURL;
        }
        return null;
    }

    // To change your profile name
    async changeProfileName(name: string) {
        const result = await this.sock.updateProfileName(name)
        console.log('changeProfileName=>', result);
        return result
    }

    async getStatusSomePerson(jid: string) {
        const status = await this.sock.fetchStatus(jid)
        return status
    }

    /**
    | =====================================================
    | For WA Groups Actions
    | =====================================================
    | 
    */
    // Create a group
    async createGroup(title: string, participants: string[]) {
        const group = await this.sock.groupCreate(title, participants)
        // group.gid
        // group.id
        return group
    }

    // To add/remove people to a group or demote/promote people
    async addParticipantToGroup(idGroup: string, jidParticipants: string[]) {
        // id & people to add to the group (will throw error if it fails)
        const response = await this.sock.groupParticipantsUpdate(
            idGroup, 
            jidParticipants,
            "add" // replace this parameter with "remove", "demote" or "promote"
        )
        return response
    }

    // To change the group's subject
    async changeGroupSubject(idGroup: string, textSubject: string) {
        return await this.sock.groupUpdateSubject(idGroup, textSubject)
    }
    //To change the group's description
    async changeGroupDescription(idGroup: string, textDescription: string) {
        return await this.sock.groupUpdateDescription(idGroup, textDescription)
    }
    // To change group settings
    async groupSettingUpdate(idGroup: string, settingOption: GroupSettingOption) {
        await this.sock.groupSettingUpdate(idGroup, settingOption)
    }
    // leave from group
    async groupLeave(idGroup: string) {
        return await this.sock.groupLeave(idGroup) // (will throw error if it fails)
    }

    async downloadFileMessage(msg: proto.IWebMessageInfo, path: string = '.') {
        if(!msg.message) return null
        const { audioMessage, imageMessage, documentMessage } = msg.message
        let extension: string;
        if(audioMessage) { 
            extension = mime.extension(audioMessage.mimetype || '') 
                || (audioMessage.ptt ? 'ogg' : 'mp3')
        } else if(imageMessage) {
            extension = mime.extension(imageMessage.mimetype || '') || 'jpeg'
        } else if(documentMessage) {
            extension = mime.extension(documentMessage.mimetype || '') || documentMessage.mimetype || 'unknown'
        } else {
            return null
        }

        const buffer = await downloadMediaMessage(
            msg,
            'buffer',
            {},
            { 
                logger: this.logger,
                // pass this so that baileys can request a reupload of media
                // that has been deleted
                reuploadRequest: this.sock.updateMediaMessage
            }
        )
        // save to file
        const filename = msg.key.id
        path = path.endsWith('/') ? path.slice(0,-1) : path
        path += `/${filename}.${extension}`

        await writeFile(path, buffer)
        return path
    }

    // add event listener
    on<T extends keyof EzWaEventMap>(event: T, listener: (arg: EzWaEventMap[T]) => void): void {
        this.event.on(event, listener)
    }

    off<T extends keyof EzWaEventMap>(event: T, listener: (arg: EzWaEventMap[T]) => void): void {
        this.event.off(event, listener)
    }

    removeAllListeners<T extends keyof EzWaEventMap>(event: T): void {
        this.event.removeAllListeners(event)
    }

    emit<T extends keyof EzWaEventMap>(event: T, arg: EzWaEventMap[T]): boolean {
        return this.event.emit(event, arg)
    }

    once<T extends keyof EzWaEventMap>(event: T, listener: (arg: EzWaEventMap[T]) => void): void {
        this.event.once(event, listener)
    }

    async waitSockConnected() {
        return new Promise((resolve) => {
            if (this.status === 'connected') {
                resolve(this.info)
            } else {
                this.once("sock.connected", (data) => {
                    resolve(data)
                })
            }
        })
    }

    
	async register(phone: string, methodVerifyOtp: 'sms'|'voice' = 'sms'): Promise<void|never> {
        const phoneNumber = parsePhoneNumber(phone)
		if(!phoneNumber?.isValid()) {
			throw new Error('Invalid phone number: ' + phone)
		}
        const mcc = PHONENUMBER_MCC[phoneNumber.countryCallingCode as TCodeMCC]
		if(!mcc) {
			throw new Error(`Could not find MCC for phone number: ${phone}\nPlease specify the MCC manually.`)
		}

        await this.startSock();
        const { registration } = this.sock.authState.creds;

        registration.phoneNumber = phoneNumber.format('E.164')
		registration.phoneNumberCountryCode = phoneNumber.countryCallingCode
		registration.phoneNumberNationalNumber = phoneNumber.nationalNumber
        registration.method = methodVerifyOtp
        registration.phoneNumberMobileCountryCode = mcc.toString()

        try {
            await this.sock.requestRegistrationCode(registration)
        } catch(error) {
            console.error('Failed to request registration code. Please try again.\n', error)
        }
	}

    async requestPairingCode() {
        if (this.pairing.mode !== 'code') return null;
        return await this.sock.requestPairingCode(this.pairing.phone)
    }

    
    setPairingMode(mode: "qr", phone: undefined): void;
    setPairingMode(mode: "code" | "mobile", phone: string): void;
    setPairingMode(mode: any, phone: any) {
        phone = phone.toString().trim()
        if (phone.startsWith('+')) phone = phone.slice(1)
        this.pairing.mode = mode
        this.pairing.phone = phone
    }


    async verifyCodeOTP(code: string|number) {
        try {
            const response = await this.sock!.register(code.toString().trim().toLowerCase())
            console.log('Successfully registered your phone number.', response)
            return true
        } catch(error) {
            console.error('Failed to register your phone number. Please try again.\n', error)
            return false
        }
    }

    async resendCodeOTP() {
		await this.sock!.requestRegistrationCode(this.sock!.authState.creds.registration)
	}
}

enum GroupSettingOption {
    // only allow admins to send messages
    ANNOUNCEMENT = 'announcement',
    // allow everyone to send messages
    NON_ANNOUNCEMENT = 'not_announcement',
    // allow everyone to modify the group's settings -- like display picture etc.
    UNLOCKED = 'unlocked',
    // only allow admins to modify the group's settings
    LOCKED = 'locked',
}
