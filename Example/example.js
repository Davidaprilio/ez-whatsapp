const readline = require('readline');
const Whatsapp = require('../lib/Whatsapp').default;

// Kode untuk registrasi
/**
(async () => {
    const wa = new Whatsapp('david-14')

	try {
		await wa.register('08xxxxxxxxxx', 'sms') // or voice
	} catch (error) {
		const message = error.message
		console.error('⚠️ ' + message)
	}
	try {
		await wa.verifyCodeOTP('xxxxxx')
	} catch (error) {
		console.log(error)
	}

    wa.onIncomingMessage((message) => {
        console.log('from:', message[0].key.remoteJid)
        const msg = wa.createMessage()
        msg.text('Halo')
        msg.send(message[0].key.remoteJid)
    })
})();
 */

// Demo
(async () => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    const question = (text) => new Promise((resolve) => rl.question(text, resolve))
    
    const wa = new Whatsapp('david-14')
    
    async function register() {
        const phone = await question('Please enter your mobile phone number:\n')
        console.log(`Your phone number is ${phone}`)
        try {
            await wa.register(phone.trim(), 'sms')
            await enterOTP()
        } catch (error) {
            const message = error.message
            console.error('⚠️ ' + message)
            return register()
        }
    }


    async function enterOTP() {
        const otp = await question('Please enter the OTP:\n')
        console.log(`Your OTP is ${otp}`)
        try {
            await wa.verifyCodeOTP(otp.trim())
        } catch (error) {
            console.log(error)
            return await enterOTP()
        }
    }

    await register()

    rl.close()

    wa.onIncomingMessage((message) => {
        console.log('from:', message[0].key.remoteJid)
        const msg = wa.createMessage()
        msg.text('Halo')
        msg.send(message[0].key.remoteJid)
    })
})()

// 1. tanpa jeda
// 2. jeda 2 detik
// 3. jeda 24 jam
// +628884966841