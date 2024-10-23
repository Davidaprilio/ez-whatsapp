import Whatsapp, { Client } from "../src/Whatsapp";

(async () => {
    const collection: Record<string, Whatsapp> = {}
    collection.wa = new Whatsapp('ez-wa', {
        browser: Client.Opera,
    });

    console.log('EZ-Whatsapp (Pairing With QR)');

    collection.wa.on('sock.connecting', () => {
        console.log('Connecting...');
    })

    collection.wa.on('sock.disconnected', (reason) => {
        console.log('Koneksi Terputus', reason);
    })

    collection.wa.on('msg.incoming', async ({message}) => {
        const msg = collection.wa!.createMessage()
        msg.text('ping!')
        msg.reply(message)
    })

    await collection.wa.startSock()
    console.log('Socket Started');
    await collection.wa.waitSockConnected()

    console.log(collection.wa.info.id, 'Connected as', collection.wa.info.jid, collection.wa.info.pushName);

    setTimeout(() => {
        delete collection.wa
    }, 3000)
})()
