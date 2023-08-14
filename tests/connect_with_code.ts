// import { delay } from "@whiskeysockets/baileys";
import Whatsapp from "../src/Whatsapp";
// import { question } from "./_utils";

(async () => {
    console.log('Starting');
    
    const wa = new Whatsapp('ez-wa', {
        // useStore: true,
        // silentLog: false,
        // pairMode: 'qr',
    });

    // wa.setPairingMode('qr', undefined); // default
    wa.setPairingMode('code', '628884966841');
    // wa.setPairingMode('mobile', 'phone');
    
    // wa.pairMode('code', 'phone');
    // wa.connect();


    wa.on('sock.connecting', () => {
        console.log('Connecting...');
    })

    wa.on('pair-code.update', (code) => {
        console.log('Pairing Code', code || 'none code'); // input to your wa app        
    })

    await wa.startSock();    

    // await delay(10_000);

    // const code = await wa.requestPairingCode();
    // console.log('Pairing Code', code);

    await wa.waitSockConnected();
})()