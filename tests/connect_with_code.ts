import Whatsapp from "../src/Whatsapp";
import { isValidNumber, question } from "../src/utils";

(async () => {
    console.log('EZ-Whatsapp (Pairing With Code)');
    
    const wa = new Whatsapp('ez-wa', {
        // silentLog: false,
        browser: ['Chrome (Linux)', '', ''],
    });

    let phone = ''
    while (true) {
        phone = await question('Enter your phone number: ');
        try {
            isValidNumber(phone)
            console.log('OK your phone is', phone);
            break
        } catch (error) {
            console.error(error.message);
            console.log('Please enter a valid phone number again \n');
        }
    }

    wa.setPairingMode('code', phone);

    wa.on('sock.connecting', () => {
        console.log('Connecting...');
    })

    wa.on('sock.connected', () => {
        console.log(wa.info.id, 'Connected as', wa.info.jid, wa.info.pushName);
    })

    wa.on('pair-code.update', (code) => {
        console.log('Pairing Code', code || 'none code'); // input to your wa app        
    })
    
    wa.on('msg.incoming', async ({message}) => {
        const msg = wa.createMessage()
        msg.text('ping!')
        msg.reply(message)
    })

    await wa.startSock();    
    await wa.waitSockConnected();

    while (true) {
        console.log('\nSend Message');
        const phone = await question('Enter your phone: ');
        const text = await question('Enter your message: ');
        const msg = wa.createMessage()
        msg.text(text)
        await msg.send(phone).then((result) => console.log(result))
    }
})()