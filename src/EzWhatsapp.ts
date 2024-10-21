import { writeFile } from 'fs/promises'
import mime from "mime-types";

import {
    AnyMessageContent,
    delay,
    makeInMemoryStore,
    Browsers,
    WAMessage,
    MessageUpsertType,
    proto,
    downloadMediaMessage,
    PHONENUMBER_MCC,
    jidEncode,
    generateWAMessageFromContent,
    MessageGenerationOptionsFromContent,
    WAProto,
    isJidUser,
} from "@whiskeysockets/baileys";

import {IClientOptions, default as WaClient} from './client'
import Group from "./group";
import { CreateButtonMessage } from "./classes/messageBuilder/createButtonMessage";
import { MessageContext } from "./classes/messageContext";

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


export default class EzWhatsapp extends WaClient {
    private _group: Group|null = null
    private _respondCollection: {
        matcher: RespondMather
        handler: RespondHandler
    }[] = []

    constructor(options?: Partial<IClientOptions>) {
        super({
            ...options,
            browser: Browsers.ubuntu(Client.Chrome)
        })
    }

    incomingMessage(message: proto.IWebMessageInfo, messageData: any) {
        this.emit('msg.incoming', {
            message,
            messageData
        })       
    }

    toJID(phoneNumber: string, type: 'user'|'group' = 'user') {
        return jidEncode(phoneNumber, type === 'group' ? 'g.us' : 's.whatsapp.net')    
    }

    async statusContact(jid: string) {
        const status = await this.sock.fetchStatus(jid);
        return status;
    }


    // createMessage(msTimeTyping?: number) {
    //     return new Message(this, msTimeTyping)
    // }


    /**
    | =====================================================
    | Action from Whatsapp Socket
    | =====================================================
    |
    */
    // Block user
    async blockUser(jid: string) {
        await this.sock.updateBlockStatus(jid, "block")
    }
    // Unblock user
    async unblockUser(jid: string) {
        await this.sock.updateBlockStatus(jid, "unblock")
    }
        


    /**
     * get info when user typing or online
     * fire event 
     */
    async presenceSubscribe(jid: string) {
        await this.sock.presenceSubscribe(jid)
    }

    async getBusinessProfile(jid: string) {
        const profile = await this.sock.getBusinessProfile(jid)
        return profile
    }

    // To change your display picture or a group's
    async changeProfilePicture(jid: string, imageUrl: string) {
        await this.sock.updateProfilePicture(jid, { url: imageUrl })
    }

    // To get the display picture of some person/group
    async getProfilePicture(highResolution = false): Promise<string|null> {
        if (this.jid) {
            this._state.photoURL = await this.fetchProfilePicture(this.jid, highResolution) || null;
            return this.state.photoURL;
        }
        return this.state.photoURL;
    }

    // To change your profile name
    async changeProfileName(name: string) {
        const result = await this.sock.updateProfileName(name)
        this.logger.debug(result, 'result change photo')
        return result
    }


    /**
     * Fetch someone profile picture
     */
    async fetchProfilePicture(jid: string, highResolution = false): Promise<string|null> {
        return await this.sock.profilePictureUrl(jid, highResolution ? "image" : "preview")
            .catch(() => null) || null
    }

    async getStatusUser(jid: string) {
        const status = await this.sock.fetchStatus(jid)
        return status
    }

    async deleteMessage(jid: string, keyMessage: proto.IMessageKey) {
        await this.sock.sendMessage(jid, { delete: keyMessage })
    }


    read(msg: WAProto.IWebMessageInfo|WAProto.IWebMessageInfo[]): void {
        this.sock.readMessages(Array.isArray(msg) ? msg.map(m => m.key) : [msg.key]);
    }


    editMessage(jid: string, key: WAProto.IMessageKey, newText: string) {
        return this.sock.sendMessage(jid, {
            text: newText,
            edit: key,
        });
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

    /**
     * For Interact with Wa Group
     * 
     * example:
     * - wa.group.all()
     * - wa.group.participants()
     * - wa.group.create()
     */
    get group() {
        if(this._group === null) this._group = new Group(this)
        return this._group
    }

    
    /**
     * reactive when message recived
     * 
     * @param matcher for decision incoming msg will reply or not
     * @param handler will run if matcher returned true
     */
    respond(
        matcher: RespondMather,
        handler: RespondHandler
    ) {
        this._respondCollection.push({
            matcher,
            handler
        })
    }

    private async runAutoRespond(messages: proto.IWebMessageInfo[]) {
        for (const message of messages) {
            let bodyMsg = message.message?.conversation || message.message?.extendedTextMessage?.text
            if (!bodyMsg) continue
            bodyMsg = bodyMsg.trim()
            if (bodyMsg === '') continue
            
            for (let {matcher, handler} of this._respondCollection) {
                if (typeof matcher === 'string') {
                    matcher = [matcher]
                }
                
                const runSafeHandler = () => {
                    try {
                        handler(new MessageContext(message, this))
                    } catch (error) {
                        this.logger.error({error}, "[Auto Response] Handler Error")
                    }
                }
    
                if (Array.isArray(matcher)) {
                    if (matcher.find(txt => txt === bodyMsg) === undefined) continue

                    runSafeHandler()
                    continue
                }

                const isMatch = await matcher(bodyMsg, message)
                    .catch(error => {
                        this.logger.error({error}, "[Auto Response] Matcher Error")
                        return false
                    })

                if (isMatch) {
                    runSafeHandler()
                }
            }
        }
    }

    protected whenSocketCreated() {
        this.sock.ev.on('messages.upsert', ({messages, type, requestId}) => {
            this.logger.debug({messages, type, requestId}, "New Message")

            this.runAutoRespond(messages)
        })
    }

    createMessage(type: 'button'|'list'|'carosel'|'text') {
        if (type === 'button') {
            return new CreateButtonMessage()
        }
        return
    }
}

type RespondMather = string|string[]|((body:string, msg: proto.IWebMessageInfo)=> Promise<boolean>)
type RespondHandler = (msgCtx: MessageContext)=> Promise<void>
