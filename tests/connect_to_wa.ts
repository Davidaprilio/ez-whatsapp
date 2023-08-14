import Whatsapp, { Client } from "../src/Whatsapp";
// import fs from "fs";
// import {
    // MessageType,
    // getChatId,
    // generateWAMessage,
    // makeInMemoryStore
    // getDevice,
// } from '@whiskeysockets/baileys'


const wa: Whatsapp = new Whatsapp('david-14A', {
    browser: Client.Opera,
    useStore: true
});

(async () => {
    console.log('Starting Socket');
    console.time('connect');
    await wa.startSock()
    console.log('Socket Started');
    
    await wa.waitSockConnected()
    console.timeEnd('connect');

    console.log('Sock Connected');
    wa.on('msg.incoming', async () => {
        // const textMsg = message.message?.conversation || message.message?.extendedTextMessage?.text
        // if (textMsg === 'ping') {
        //     const msg = wa.createMessage()
        //     msg.text('Pong!')
        //     msg.reply(message)
        // }

        // if (message.key.remoteJid!.includes('@g.')) {
        //     await wa.sock.groupMetadata(message.key.remoteJid!).then((data) => {
        //         console.log('Group: ', data.subject)
        //         console.log(data.id);
        //     })
        // }

        // console.log(message)

        // // save to file
        // const filename = 'test'
        // fs.writeFileSync(
        //     `./${filename}.json`, 
        //     JSON.stringify(message, undefined, 4)
        // )
    })

    // console.log('Device', getDevice(''));
    // console.log('Getting Data');
    // const data = await wa.sock.

    // const ss: MessageType = 'audioMessage'

    // console.log('Data:', wa.getStore?.messages['sas']);
    wa.on('sock.disconnected', (reason) => {
        console.log('Koneksi Terputus', reason);
    })    
    // setTimeout(async () => {
    //     await wa.logout()
    // }, 35_000);

    await wa.sendMessageWithTyping('628884966841', {
        text: 'test'
    }, undefined, 5_000)

    console.log('terkirim');
    

})()