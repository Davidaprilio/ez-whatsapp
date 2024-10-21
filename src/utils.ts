import readline from 'readline'
import {parsePhoneNumber} from "libphonenumber-js"
import { jidEncode, proto } from '@whiskeysockets/baileys'

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
