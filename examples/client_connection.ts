import { delay } from "@whiskeysockets/baileys";
import Client from "../src/client"

(async () => {
    const client = new Client({
        printQRInTerminal: true,
    })

    await client.startSock()
    console.log('connecting .....');
    await client.waitSockConnected()
    console.log('connected!');

    await delay(5_000)

    await client.stopSock()
    console.log('disconnecting ...');
    await client.waitSockStopped()
    console.log('disconnected');

    await delay(5_000)
    
    await client.startSock()
    console.log('connecting .....');
    await client.waitSockConnected()
    console.log('connected!');

    await delay(5_000)

    await client.stopSock()
    console.log('disconnecting ...');
    await client.waitSockStopped()
    console.log('disconnected');

    console.log('proccess ended')
})()