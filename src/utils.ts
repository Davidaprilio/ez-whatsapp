import readline from 'readline'
import {parsePhoneNumber} from "libphonenumber-js"

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