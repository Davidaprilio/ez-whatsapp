import { convertToJID, jidToNumberPhone } from "../src/helper";

describe('convertToJID Function', () => {
    test('full phone', () => {
        const resultPhone = convertToJID('6185123456789', 62);
        expect(resultPhone).toEqual('6185123456789@s.whatsapp.net')
    })

    test('phone begining with zero', () => {
        const resultPhone = convertToJID('085123456789', 62);
        expect(resultPhone).toEqual('6285123456789@s.whatsapp.net')
    })

    test('jid group - there can be no change', () => {
        const resultPhone = convertToJID('3231726873627812738@g.us');
        expect(resultPhone).toEqual('3231726873627812738@g.us')
    })
})


describe('jidToNumberPhone Function', () => {
    test('should return phone', () => {
        const phone = jidToNumberPhone('6285123456789@s.whatsapp.net')
        expect(phone).toEqual('6285123456789')
    })
    test('should return null', () => {
        const phone = jidToNumberPhone()        
        expect(phone).toEqual(null)
    })
})