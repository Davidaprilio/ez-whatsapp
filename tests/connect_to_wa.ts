import Whatsapp, { Client } from "../src/Whatsapp";
import { question } from "../src/utils";

const wa: Whatsapp = new Whatsapp('ez-wa', {
    browser: Client.Opera,
});

(async () => {
    console.log('EZ-Whatsapp (Pairing With QR)');
    wa.on('sock.connecting', () => {
        console.log('Connecting...');
    })

    wa.on('sock.disconnected', (reason) => {
        console.log('Koneksi Terputus', reason);
    })

    await wa.startSock()
    console.log('Socket Started');
    await wa.waitSockConnected()

    console.log(wa.info.id, 'Connected as', wa.info.jid, wa.info.pushName);
    wa.on('msg.incoming', async ({message}) => {
        const msg = wa.createMessage()
        msg.text('ping!')
        msg.reply(message)
    })

    while (true) {
        console.log('\nSend Message');
        const phone = await question('Enter your phone: ');
        const text = await question('Enter your message: ');
        const msg = wa.createMessage()
        msg.text(text)
        await msg.send(phone).then((result) => console.log(result))
    }
})()