import Whatsapp, { Client } from "../src/Whatsapp";
const wa: Whatsapp = new Whatsapp('david-14A', {
    browser: Client.Opera
});

(async () => {
    console.log('Starting Socket');
    await wa.startSock()
    console.log('Socket Started');

    await wa.waitSockConnected()

})()