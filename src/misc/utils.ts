import readline from 'readline'
import {parsePhoneNumber} from "libphonenumber-js"
import { AnyMediaMessageContent, jidEncode, prepareWAMessageMedia, proto, WASocket } from '@whiskeysockets/baileys'
import { dirname } from "path";
import QRCode from 'qrcode';
import { IButtonParams, IButtonProps, IVCard } from './types';

// Read line interface
const rl = readline.createInterface({ 
    input: process.stdin, 
    output: process.stdout 
})

export function question(text: string, defaultValue: string = '') {
    return new Promise<string>((resolve) => rl.question(text, (answer) => resolve(answer || defaultValue)))
}


export function isValidNumber(phoneNumber: string, throwError: boolean = true): boolean|never {
    try {
        phoneNumber = phoneNumber.trim()
        if (!phoneNumber.startsWith('+')) phoneNumber = `+${phoneNumber}`
        const parsedPhoneNumber = parsePhoneNumber(phoneNumber)
        if(!parsedPhoneNumber.isValid()) {
            throw new Error('Invalid phone number: ' + phoneNumber + ', please provide valid country code like (+62)', {
                cause: 'invalid phone number'
            })
        }
        return true
    } catch (error) {
        if (throwError) throw error
        return false
    }
}

export function isIfaceInteractiveMessage(obj: any): obj is proto.Message.IInteractiveMessage {
    const props = [
        'shopStorefrontMessage',
        'collectionMessage',
        'nativeFlowMessage',
        'carouselMessage',
    ];

    return props.some(prop => obj.hasOwnProperty(prop));
}

export function toJID(phoneNumber: string, type: 'user'|'group' = 'user') {
    return jidEncode(phoneNumber, type === 'group' ? 'g.us' : 's.whatsapp.net')    
}

export const rootPath = (path: string) => {
    return dirname(path) + '|' + process.cwd();
}

export const makeQrImage = async (qrCode: string) => {
    return await QRCode.toDataURL(qrCode);
}

export function createObjectButtonMessage<T extends keyof IButtonParams>(type: T, params: IButtonParams[T]): IButtonProps {
    return {
        name: type,
        buttonParamsJson: JSON.stringify(params)
    }
}

export function ucFirst(string: string) {
    return string.charAt(0).toUpperCase() + string.slice(1)
}

interface IInteractiveMessageContent {
    title?: string
    body?: string
    footer?: string
    contextInfo?: proto.Message.IInteractiveMessage['contextInfo']
    carouselMessage?: proto.Message.IInteractiveMessage['carouselMessage']
    nativeFlowMessage?: proto.Message.IInteractiveMessage['nativeFlowMessage']
}

export function createInteractiveMessageContent(content: IInteractiveMessageContent, mediaMessage?: proto.Message): proto.Message.IInteractiveMessage {
    const msg: proto.Message.IInteractiveMessage = {}

    if (mediaMessage) {
        msg.header = proto.Message.InteractiveMessage.Header.create({
            hasMediaAttachment: true,
            ...mediaMessage
        })
    }

    for (const key in content) {
        if (!content[key]) {
            continue
        }
        if (key === 'title') {
            if (!msg.header) {
                msg.header = proto.Message.InteractiveMessage.Header.create({})
            }
            msg.header.title = content[key]
        } else {
            let classConstruct = proto.Message.InteractiveMessage[ucFirst(key)] as any;
            msg[key] = classConstruct.create(typeof content[key] === 'string' ? {text: content[key]} : content[key]);
        }
    }

    return proto.Message.InteractiveMessage.create(msg)    
}


/**
 * create vcard string format 
 * phone must be include country code without +
 *
 */
export function createVCardFormat(props: IVCard) {
    const phoneParsed = props.phone.trim().match(/\d+/g)?.join('') ?? ''
    if (phoneParsed === '') {
        throw new Error('invalid given phone number')
    }
    props.phone = phoneParsed

    return [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${props.fullName}`,
        `ORG:${props.org??''};`,
        `TEL;type=CELL;type=VOICE;waid=${props.phone}:+${props.phone}`,
        'END:VCARD',
    ].join('\n')
}
