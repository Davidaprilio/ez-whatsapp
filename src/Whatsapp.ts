import { Boom } from "@hapi/boom";
import fs from "fs";
import parsePhoneNumber from 'libphonenumber-js'
import { writeFile } from 'fs/promises'
import { randomUUID } from "crypto";
import P, { Logger } from "pino";
import mime from "mime-types";

const logger = P({
	level: 'trace'
})

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
    PresenceData,
    // makeCacheableSignalKeyStore,
    WASocket,
    downloadMediaMessage,
	makeCacheableSignalKeyStore,
    PHONENUMBER_MCC
} from "../baileys/lib";

declare type MakeInMemoryStore = ReturnType<typeof makeInMemoryStore>;

import { convertToJID, log, jidToNumberPhone } from "./helper";
import NodeCache from "node-cache";
import Message from "./message";


export enum Client {
    Chrome = 'Chrome',
    Firefox = 'Firefox',
    Safari = 'Safari',
    Edge = 'Edge',
    Opera = 'Opera',
    Desktop = 'Desktop'
}

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

type PresenceUpdate = { 
    id: string, 
    presences: { 
        [participant: string]: PresenceData
    } 
}

interface CallableFunctions {
    onStoped: Function,
    onDisconnected: Function,
    onConnecting: Function,
    onScanQR: Function,
    onConnected: Function,
    onIncomingMessage: Function,
    onClickButtonMessage: Function,
    onReactionMessage: Function,
    onStopedSession: Function,
}

interface WhatsappOption {
    browser: string | Client | [string,string,string],
    storeSession: boolean,
    showQRcode: boolean,
    silentLog: boolean
}

interface ClientInfo {
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

export default class Whatsapp {
    info: ClientInfo;
    sock?: WASocket; // Socket dari makeWALegacySocket | makeWASocket

    // private queueMessage: [];
    private status: string;
    private useMobile: boolean = false;
    private saveState: any;
    private connectionLostCount: number = 0; // jumlah koneksi timeout 
    private store: MakeInMemoryStore|undefined;
    private logger: Logger;
    private silentLogging: boolean;
    private isStopedByUser: boolean = false;
    private attemptQRcode: number = 0;
    private callableFunctions: CallableFunctions = {
        onConnected: () => {},
        onDisconnected: () => {},
        onConnecting: () => {},
        onStoped: () => {},
        onScanQR: () => {},
        onIncomingMessage: () => {},
        onClickButtonMessage: () => {},
        onReactionMessage: () => {},
        onStopedSession: () => {},
    }
    private options = {
        showQRCode: false
    };

    constructor(
        client_id?: string | null, 
        hostname: string | null = null,
        moreOptions?: Partial<WhatsappOption>
    ) {
        const defaultOptions: WhatsappOption = {
            browser: Client.Chrome,
            showQRcode: false,
            silentLog: true,
            storeSession: true,
        } 
        const options: WhatsappOption = { ...defaultOptions, ...moreOptions }

        this.options.showQRCode = options.showQRcode
        this.silentLogging = options.silentLog;
        if (client_id === null || client_id === undefined) {
            client_id = "wac-" + randomUUID();
        }
        const pathAuth = `.session/auth-state/${client_id}`;

        const browserSocket = Array.isArray(options.browser) ? options.browser : Browsers.appropriate(options.browser);
        // create name host
        if (hostname) {
            if (browserSocket[1] in Client) {
                browserSocket[0] = hostname
            } else {
                browserSocket[0] = `${browserSocket[1]}(${hostname})`
            }
        }

        this.info = {
            id: client_id,
            hostname,
            authPath: pathAuth,
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
		this.status = this.info.status

        // make Logger
        this.logger = logger;
        this.logger.level = this.silentLogging ? "silent" : "debug";

        if (options.storeSession) {
            // buat path untuk simpan auth session
            if (!fs.existsSync(pathAuth)) fs.mkdirSync(pathAuth, { recursive: true });

            // this.setStatusDeviceDeactive();
            // untuk menyimpan data socket, session, chat dll
            this.store = makeInMemoryStore({logger});
        }
    }

	async resendCodeOTP() {
		await this.sock!.requestRegistrationCode(this.sock!.authState.creds.registration)
	}

	async register(phone: string, methodVerifyOtp: 'sms'|'voice' = 'sms'): Promise<void|never> {
        const phoneNumber = parsePhoneNumber(phone)
		if(!phoneNumber?.isValid()) {
			throw new Error('Invalid phone number: ' + phone)
		}
        const mcc = PHONENUMBER_MCC[phoneNumber.countryCallingCode]
		if(!mcc) {
			throw new Error(`Could not find MCC for phone number: ${phone}\nPlease specify the MCC manually.`)
		}

        this.useMobile = true;
        await this.startSock();
        if (this.sock === undefined) {
            throw new ErrorShouldStartSocket();
        }
        const { registration } = this.sock.authState.creds;

        registration.phoneNumber = phoneNumber.format('E.164')
		registration.phoneNumberCountryCode = phoneNumber.countryCallingCode
		registration.phoneNumberNationalNumber = phoneNumber.nationalNumber
        registration.method = methodVerifyOtp
        registration.phoneNumberMobileCountryCode = mcc

        try {
            await this.sock.requestRegistrationCode(registration)
        } catch(error) {
            console.error('Failed to request registration code. Please try again.\n', error)
        }
	}

	createEvenListener() {
		if (this.sock === undefined) {
			throw new ErrorShouldStartSocket();
            
		}
		// Pesan masuk
        this.sock.ev.on("messages.upsert", async ({ messages, type }: MessageUpsert) => {
            // notify => notify the user, this message was just received
            // append => append the message to the chat history, no notification required
            if (type === "append" || type === "notify") {
                messages.forEach(msg => {
                    const { pushName, messageTimestamp, key, message } = msg;
                    const { id: messageID, remoteJid: jid } = key
                    const phone = jidToNumberPhone(jid || '');
                    
                    if (key.fromMe) {
                        // event.emit("message.out", this.info.id, {
                        //     messageID,
                        //     timestamp: messageTimestamp,
                        // });
                    } else {
                        const isGroup = isJidGroup(jid || undefined) || false;
                        this.incomingMessage(msg, isGroup, key.fromMe || false, jid || null, messageID || null)
                        // Incomming Messages
                        // event.emit("message.in", this.info.id, {
                        //     messageID,
                        //     jid,
                        //     pushName,
                        //     phone,
                        //     text: message?.conversation,
                        //     timestamp: messageTimestamp,
                        // });
                    }
                })
            } else {
                console.log("Incoming Message unknown Type: ", type, messages);
            }
        });

        // Perubahan Pesan
        this.sock.ev.on("messages.update", (m: any) => {
            log("===============  messages.update  ================");
            log(JSON.stringify(m, undefined, 2));
        });

        // State Update Online|Offline
        this.sock.ev.on("presence.update", (presence: PresenceUpdate) => this.presenceUpdated(presence));
        // this.sock.ev.on("chats.update", (m: any) => log(m));
        // this.sock.ev.on("contacts.update", (m: any) => log(m));

        this.sock.ev.on("connection.update", (update: any) => {
            this.connectionUpdate(update);
        });

        // listen for when the auth credentials is updated
        this.sock.ev.on("creds.update", this.saveState);

        this.sock.ev.on("messages.reaction", (arg: { key: proto.IMessageKey; reaction: proto.IReaction; }[]) => {
            log("Reaction", arg)
            this.emitCallback(
                this.callableFunctions.onReactionMessage,

            )
        });
		return true
	}

    startSock = async (skipStopState = false) => {
        if (skipStopState) {
            this.isStopedByUser = false;
        }

        if (this.status == "active") {
            console.log(`Client ${this.info.id} already connected`);
            return this.sock;
        }

        // buat sock dari client yang diberikan
		console.log('Membuat Socket')
        await this.createSock(this.info.browser);
		console.log('Socket Dibuat')

        if (this.sock === undefined) return;

		this.store?.bind(this.sock.ev);

		if(this.useMobile && !this.sock.authState.creds.registered) {
			// const question = (text: string) => new Promise<string>((resolve) => rl.question(text, resolve))
	
			// const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
			// const { registration } = sock.authState.creds || { registration: {} }
	
			// if(!registration.phoneNumber) {
			// 	registration.phoneNumber = await question('Please enter your mobile phone number:\n')
			// } else {
			// 	console.log('Your mobile phone number is not registered.')
			// }
	
			// const phoneNumber = parsePhoneNumber(registration!.phoneNumber)
			// if(!phoneNumber?.isValid()) {
			// 	throw new Error('Invalid phone number: ' + registration!.phoneNumber)
			// }
	
			// registration.phoneNumber = phoneNumber.format('E.164')
			// registration.phoneNumberCountryCode = phoneNumber.countryCallingCode
			// registration.phoneNumberNationalNumber = phoneNumber.nationalNumber
			// const mcc = PHONENUMBER_MCC[phoneNumber.countryCallingCode]
			// if(!mcc) {
			// 	throw new Error('Could not find MCC for phone number: ' + registration!.phoneNumber + '\nPlease specify the MCC manually.')
			// }
	
			// registration.phoneNumberMobileCountryCode = mcc
	
			// async function enterCode() {
			// 	try {
			// 		const code = await question('Please enter the one time code:\n')
			// 		const response = await sock.register(code.replace(/["']/g, '').trim().toLowerCase())
			// 		console.log('Successfully registered your phone number.')
			// 		console.log(response)
			// 		rl.close()
			// 	} catch(error) {
			// 		console.error('Failed to register your phone number. Please try again.\n', error)
			// 		await askForOTP()
			// 	}	
			// }
	
			// async function askForOTP() {
			// 	let code = await question('How would you like to receive the one time code for registration? "sms" or "voice"\n')
			// 	code = code.replace(/["']/g, '').trim().toLowerCase()
	
			// 	if(code !== 'sms' && code !== 'voice') {
			// 		return await askForOTP()
			// 	}
	
			// 	registration.method = code
	
			// 	try {
			// 		await sock.requestRegistrationCode(registration)
			// 		await enterCode()
			// 	} catch(error) {
			// 		console.error('Failed to request registration code. Please try again.\n', error)
			// 		await askForOTP()
			// 	}
			// }
	
			// askForOTP()
		}

		console.log(
			'Registred:',
			this.sock.authState.creds.registered
		)

        // setInterval(() => {
        //   this.store.writeToFile(this.info.store);
        // }, 10_000);

        return this.sock;
    };

    incomingMessage(message: proto.IWebMessageInfo, isGroup: boolean, isFromMe: boolean, jid: string|null, messageID: string|null) {
        this.emitCallback(
            this.callableFunctions.onIncomingMessage,
            message,
            isGroup,
            isFromMe,
            jid,
            messageID
        )        
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
    async createSock(
        browser: [string, string, string],
        showQRcode: boolean = true,
    ) {
        const { version, isLatest } = await fetchLatestBaileysVersion();
        console.log(`====================== Whatsapp API ======================`);
        console.log(` Using WA v${version.join(".")} | isLatest: ${isLatest} | cid: ${this.info.id}`);
        console.log("==========================================================");

        // memulihkan session sebelumnya jika dulu disimpan
        const { state, saveCreds } = await useMultiFileAuthState(this.info.authPath);
        this.saveState = saveCreds;

		const msgRetryCounterCache = new NodeCache()
        try {
            const conn = makeWASocket({
                version,
                logger,
                browser,
				mobile: this.useMobile,
                printQRInTerminal: showQRcode,
                auth: {
                    creds: state.creds,
                    /** caching makes the store faster to send/recv messages */
                    // keys: state.keys
                    keys: makeCacheableSignalKeyStore(state.keys, logger),
                },
                msgRetryCounterCache,
                generateHighQualityLinkPreview: true,
                syncFullHistory: true
            })
            this.sock = conn;
        } catch (error) {
            console.log("Socket Error:", error);
        }
        return this.sock;
    }

    /**
     * Handle Connection Update
     *
     */
    private async connectionUpdate(update: ConnectionState): Promise<void> {
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
            this.emitCallback(this.callableFunctions.onStopedSession)
        }
        // Reconnect jika connection close (bukan dari user)
        else if (connection === "close") {
            this.info.status = "connecting";
            if (lastDisconnect) {
                const err = (lastDisconnect.error as Boom).output;
                // Connection Gone (hilang/rusak)
                if (err.statusCode === 410 || err?.payload.message === "Stream Errored") {
                    console.log("Stream Errored", err.payload);
                    try {
                        await this.stopSock();
                    } catch (error) {
                        console.log("Stoped sock", error);
                    }
                    setTimeout(() => {
                        this.startSock(true);
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
                    this.logger.error(msg + ' SOCKET CLOSED +++++++++++++++++++++++++++++')
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
                this.socketConnecting()
            }
            // event.emit("device.connection.update", this.info.id, {
            //     status: this.info.status,
            //     isAuth: this.info.isAuth,
            //     info: this.info.status === "connected" ? this.info : null,
            // });
        }
        // log("connection update: END");
    }



    // Event Handler
    private socketConnected() {
		if (this.sock === undefined) throw new ErrorShouldStartSocket();
        this.logger.info("Connection Open");
        this.attemptQRcode = 0;
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

        // event.emit('connection.connected', this.info)

        const infoSocket = this.getInfoSocket()

        this.emitCallback(this.callableFunctions.onConnected, infoSocket)
    }

    private socketScanQR(codeQR: string) {
        log("QR Code Update");
        if (this.attemptQRcode > 5) {
            console.log("Stoped Device because 5x not scanning QRcode (not used)");
            this.stopSock();
            return;
        } else {
            this.attemptQRcode++;
        }
        this.resetStatusClient();
        this.info.isAuth = false;
        this.info.qrCode = codeQR;
        this.info.status = "scan QR";
        const data = {
            qrCode: codeQR,
        }
        // event.emit("device.qrcode.update", this.info.id, data);
        this.emitCallback(this.callableFunctions.onScanQR, data)
    }

    private socketConnecting() {
        const reasonInfo = {
            reason: 'soket rusak'
        }

        // event.emit('connection.connecting', reasonInfo)
    }

    private socketLogout() {
        log("Client Is Logout");
        this.info.isAuth = false;
        this.info.status = "disconnected";
        this.setStatusDeviceDeactive();
        this.removeSessionPath();
        const reasonInfo = {
            reason: 'Logout',
        }
        // event.emit('connection.disconnected', reasonInfo)
        this.emitCallback(this.callableFunctions.onDisconnected, reasonInfo)
    }

    private presenceUpdated(presence: PresenceUpdate) {
        // event.emit('presence.update', presence)
    }
    // END: Event Handler


    /**
     * Only stop socket connection (safe socket credential)
     */
    async stopSock() {
        if (this.sock === undefined) throw new ErrorShouldStartSocket();
        this.isStopedByUser = true; // Set StopByUser true agar tidak di Reconnect oleh connectionUpdate()
        this.sock.ws.removeAllListeners();
		this.sock.ws.close()

        this.setStatusDeviceDeactive();
    }

    async logout() {
        if (this.sock === undefined) throw new ErrorShouldStartSocket();
        await this.sock.logout()
    }

    /**
     * Handle Remove Session Path
     */
    private removeSessionPath() {
        if (fs.existsSync(this.info.authPath)) {
            fs.rmSync(this.info.authPath, { recursive: true, force: true });
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

    // emiter callable function
    private emitCallback(callback: Function, ...data: any) {
        return new Promise((resolve, reject) => {
            try {
                callback(...data)
                resolve(true)
            } catch (error) {
                reject(error)
            }
        })
    }

    // Register Callable Event Function
    onConnected(callback: Function) {
        this.callableFunctions.onConnected = callback
    }
    onConnecting(callback: Function) {
        this.callableFunctions.onConnecting = callback
    }
    onDisconnected(callback: Function) {
        this.callableFunctions.onDisconnected = callback
    }
    onIncomingMessage(callback: Function) {
        this.callableFunctions.onIncomingMessage = callback
    }
    onClickButtonMessage(callback: Function) {
        this.callableFunctions.onClickButtonMessage = callback
    }
    onReactionMessage(callback: Function) {
        this.callableFunctions.onReactionMessage = callback
    }
    onStopedSession(callback: Function) {
        this.callableFunctions.onStopedSession = callback
    }
    // END: Register Callable Event Function

    // dummy
    private getInfoSocket() {
        const infoSocket: object = {
            name: 'david',
            phone: '629361836372',
        }
        return infoSocket
    }

    sendMessageWithTyping = async (
        jid: string,
        msg: AnyMessageContent,
        replayMsg?: proto.IWebMessageInfo,
        msTimeTyping?: number
    ) => {
        if (this.sock === undefined) throw new ErrorShouldStartSocket();

        await this.sock.presenceSubscribe(jid);
        await delay(100);

        await this.sock.sendPresenceUpdate("composing", jid);
        await delay(msTimeTyping ?? 250); //ms

        await this.sock.sendPresenceUpdate("paused", jid);
        const quotedMsg = replayMsg ? { quoted: replayMsg } : replayMsg;
        try {
            console.log(quotedMsg);
            return await this.sock.sendMessage(jid, msg, quotedMsg);
        } catch (error) {
            const err = (error as Boom)?.output;
            console.error("Send message", error, err?.payload ?? err);
            return {
                status: false,
                error: true,
                message: "failed to send message",
                response: err?.payload ?? err,
                err: err.payload.message
            };
        }
    };

    /**
     * Checking Phone Number is Registration on Whatsapp
     */
    async isRegistWA(numberPhone: string): Promise<boolean> {
        if (this.sock === undefined) throw new ErrorShouldStartSocket();
        const phone = convertToJID(numberPhone);
        let res = await this.sock.onWhatsApp(phone);
        return res[0]?.exists ?? false;
    }

    async statusContact(jid: string) {
        if (this.sock === undefined) throw new ErrorShouldStartSocket();
        const status = await this.sock.fetchStatus(jid);
        return status;
    }

    async fetchProfilePicture(
        jid: string,
        highResolution = false
    ): Promise<string|undefined> {
        if (this.sock === undefined) throw new ErrorShouldStartSocket();
        if (highResolution) {
            // for high res picture
            return await this.sock.profilePictureUrl(jid, "image");
        } else {
            // for low res picture
            return await this.sock.profilePictureUrl(jid);
        }
    }

    createMessage() {
        return new Message(this)
    }

    /**
    | =====================================================
    | Action from Whatsapp Socket
    | =====================================================
    |
    */
    async deleteMessage(jid: string, keyMessage: proto.IMessageKey) {
        if (this.sock === undefined) throw new ErrorShouldStartSocket();
        await this.sock.sendMessage(jid, { delete: keyMessage })
    }

    // Block user
    async blockUser(jid: string) {
        if (this.sock === undefined) throw new ErrorShouldStartSocket();
        await this.sock.updateBlockStatus(jid, "block")
    }
    // Unblock user
    async unblockUser(jid: string) {
        if (this.sock === undefined) throw new ErrorShouldStartSocket();
        await this.sock.updateBlockStatus(jid, "unblock")
    }

    async getBusinessProfile(jid: string) {
        if (this.sock === undefined) throw new ErrorShouldStartSocket();
        const profile = await this.sock.getBusinessProfile(jid)
        return profile
    }

    // Untuk mendapatkan kehadiran seseorang (jika mereka sedang mengetik atau online)
    async presenceSubscribe(jid: string) {
        if (this.sock === undefined) throw new ErrorShouldStartSocket();
        await this.sock.presenceSubscribe(jid)
    }

    // To change your display picture or a group's
    async changeProfilePicture(jid: string, imageUrl: string) {
        if (this.sock === undefined) throw new ErrorShouldStartSocket();
        await this.sock.updateProfilePicture(jid, { 
            url: imageUrl
        })
    }

    // To get the display picture of some person/group
    async getProfilePicture(highResolution = false): Promise<string|null> {
        if (this.info.jid) {
            this.info.ppURL = await this.fetchProfilePicture(this.info.jid, highResolution) || null;
            // event.emit('info.profile.photo', this.info.id, this.info.ppURL)
            return this.info.ppURL;
        }
        return null;
    }

    // To change your profile name
    async changeProfileName(name: string) {
        if (this.sock === undefined) throw new ErrorShouldStartSocket();
        const result = await this.sock.updateProfileName(name)
        console.log('changeProfileName=>', result);
        return result
    }

    async getStatusSomePerson(jid: string) {
        if (this.sock === undefined) throw new ErrorShouldStartSocket();
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
        if (this.sock === undefined) throw new ErrorShouldStartSocket();
        const group = await this.sock.groupCreate(title, participants)
        // group.gid
        // group.id
        return group
    }

    // To add/remove people to a group or demote/promote people
    async addParticipantToGroup(idGroup: string, jidParticipants: string[]) {
        // id & people to add to the group (will throw error if it fails)
        if (this.sock === undefined) throw new ErrorShouldStartSocket();
        const response = await this.sock.groupParticipantsUpdate(
            idGroup, 
            jidParticipants,
            "add" // replace this parameter with "remove", "demote" or "promote"
        )
        return response
    }

    // To change the group's subject
    async changeGroupSubject(idGroup: string, textSubject: string) {
        if (this.sock === undefined) throw new ErrorShouldStartSocket();
        return await this.sock.groupUpdateSubject(idGroup, textSubject)
    }
    //To change the group's description
    async changeGroupDescription(idGroup: string, textDescription: string) {
        if (this.sock === undefined) throw new ErrorShouldStartSocket();
        return await this.sock.groupUpdateDescription(idGroup, textDescription)
    }
    // To change group settings
    async groupSettingUpdate(idGroup: string, settingOption: GroupSettingOption) {
        if (this.sock === undefined) throw new ErrorShouldStartSocket();
        await this.sock.groupSettingUpdate(idGroup, settingOption)
    }
    // leave from group
    async groupLeave(idGroup: string) {
        if (this.sock === undefined) throw new ErrorShouldStartSocket();
        return await this.sock.groupLeave(idGroup) // (will throw error if it fails)
    }

    async downloadFileMessage(msg: proto.IWebMessageInfo, path: string = '.') {
        if (this.sock === undefined) throw new ErrorShouldStartSocket();
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
                logger,
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

    async verifyCodeOTP(code: string|number) {
        try {
            const response = await this.sock?.register(code.toString().trim().toLowerCase())
            console.log('Successfully registered your phone number.')
            console.log(response)
            return true
        } catch(error) {
            console.error('Failed to register your phone number. Please try again.\n', error)
            return false
        }	
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


class ErrorShouldStartSocket extends Error {
    constructor() {
        super('Please start the socket first');
        this.name = "ErrorShouldStartSocket";
    }
}