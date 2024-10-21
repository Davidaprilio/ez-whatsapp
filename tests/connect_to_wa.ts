import {
    delay,
    generateWAMessageFromContent,
    proto,
    prepareWAMessageMedia 
} from "@whiskeysockets/baileys";
import Whatsapp, { Client } from "../src/Whatsapp";
// import { question } from "../src/utils";
import { convertToJID } from "../src/helper";

const wa: Whatsapp = new Whatsapp('ez-wa', {
    browser: Client.Opera,
});


export interface IInteractiveMessageContent { 
    body?: string;
    footer?: string;
    header?: (proto.Message.InteractiveMessage.IHeader|null);
    contextInfo?: (proto.IContextInfo|null);
    shopStorefrontMessage?: (proto.Message.InteractiveMessage.IShopMessage|null);
    collectionMessage?: (proto.Message.InteractiveMessage.ICollectionMessage|null);
    nativeFlowMessage?: (proto.Message.InteractiveMessage.INativeFlowMessage|null);
    carouselMessage?: (proto.Message.InteractiveMessage.ICarouselMessage|null);
}

export const makeRealInteractiveMessage = (content: IInteractiveMessageContent): proto.Message.IInteractiveMessage => {
    let contentReal: proto.Message.IInteractiveMessage = {};

    Object.keys(content).map((x) => {
        if (x === 'body') {
            contentReal['body'] = proto.Message.InteractiveMessage.Body.create({ text: content.body });
        } else if (x === 'footer') {
            contentReal['footer'] = proto.Message.InteractiveMessage.Footer.create({ text: content.footer });
        } else if (x === 'contextInfo') {
            contentReal['contextInfo'] = content['contextInfo'];
        } else if (x === 'shopStorefrontMessage') {
            contentReal['shopStorefrontMessage'] = proto.Message.InteractiveMessage.ShopMessage.create(content['shopStorefrontMessage']!);
        } else {
            let prop = proto.Message.InteractiveMessage[x.charAt(0).toUpperCase() + x.slice(1) as keyof typeof proto.Message.InteractiveMessage] as any;
            contentReal[x] = prop.create(content[x as keyof typeof content]);
        }
    });

    return contentReal;
}

export type ButtonType = 'cta_url' | 'cta_call' | 'cta_copy' | 'cta_reminder' | 'cta_cancel_reminder' | 'address_message' | 'send_location' | 'quick_reply';

export class ButtonBuilder {
    id: string | null;
    displayText: string | null
    type: ButtonType;
    merhcant_url: string | null;
    url: string | null;
    copy_code: string | null;

    constructor(opts?: {
        id: null,
        displayText: null,
        type: 'quick_reply',
        merhcant_url: null,
        url: null,
        copy_code: null;
    }) {
        this.id = opts?.id || null;
        this.displayText = opts?.displayText || null;
        this.type = opts?.type || 'quick_reply';
        this.merhcant_url = opts?.merhcant_url || null; 
        this.url = opts?.url || null; 
        this.copy_code = opts?.copy_code || null;
    }

    setId(id: string) {
        this.id = id;
        return this
    }

    setDisplayText(text: string) {
        this.displayText = text;
        return this
    }

    setType(type: ButtonType = 'quick_reply') {
        this.type = type;
        return this
    }

    setMerchantURL(url: string) {
        this.merhcant_url = url;
        return this
    }

    setURL(url: string) {
        this.url = url;
        return this
    }

    setCopyCode(content: string) {
        this.copy_code = content;
        return this
    }

    build() {
        return {
            name: this.type,
            buttonParamsJson: JSON.stringify({ display_text: this.displayText, id: this.id, copy_code: this.copy_code, merhcant_url: this.merhcant_url, url: this.url })
        }
    }
}


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
    // wa.on('msg.incoming', async ({message}) => {
    //     const msg = wa.createMessage()
    //     msg.text('ping!')
    //     msg.reply(message)
    // })

    const phone = '628884966841';
    const jid = convertToJID(phone)

    const media = await prepareWAMessageMedia({
        image: { 
            url:  "https://github.com/mengkodingan.png" 
        } 
    }, {
        upload: wa.sock.waUploadToServer
    })


    let button = new ButtonBuilder()
      .setId('!ping')
      .setDisplayText('command Ping')
      .setType('quick_reply')
      .build();
    
    let button2 = new ButtonBuilder()
      .setId('!ping')
      .setDisplayText('command Ping')
      .setType('quick_reply')
      .build();
    

    // const content: proto.Message.IInteractiveMessage = {
    //     body: proto.Message.InteractiveMessage.Body.create({text: "This is body"}),
    //     footer: proto.Message.InteractiveMessage.Body.create({text: "this is footer"}),
    //     carouselMessage: proto.Message.InteractiveMessage.CarouselMessage.create({
    //         cards: [
    //             {
    //                 body: proto.Message.InteractiveMessage.Body.create({text: 'Slider 1'}),
    //                 header: {
    //                     title: "HEADER TITLE 1",
    //                     hasMediaAttachment: true,
    //                     ...media
    //                 },
    //                 nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
    //                     buttons: [
    //                         // proto.Message.InteractiveMessage.NativeFlowMessage.NativeFlowButton.create(
    //                             {
    //                                 name: 'quick_reply',
    //                                 buttonParamsJson: JSON.stringify({ 
    //                                     display_text: 'Display Btn 1', 
    //                                     id: 'btn1', 
    //                                     // copy_code: this.copy_code, 
    //                                     // merhcant_url: this.merhcant_url, 
    //                                     // url: this.url 
    //                                 })
    //                             }
    //                         // )
    //                     ]
    //                 })
    //             },
    //             {
    //                 body: proto.Message.InteractiveMessage.Body.create({text: 'Slider 2'}),
    //                 header: proto.Message.InteractiveMessage.Header.create({
    //                     title: "HEADER TITLE 2",
    //                     hasMediaAttachment: true,
    //                     ...media
    //                 }),
    //                 nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
    //                     buttons: [
    //                         // proto.Message.InteractiveMessage.NativeFlowMessage.NativeFlowButton.create(
    //                             {
    //                                 name: 'quick_reply',
    //                                 buttonParamsJson: JSON.stringify({ 
    //                                     display_text: 'Display Btn 2', 
    //                                     id: 'btn2', 
    //                                     // copy_code: this.copy_code, 
    //                                     // merhcant_url: this.merhcant_url, 
    //                                     // url: this.url 
    //                                 })
    //                             }
    //                         // )
    //                     ]
    //                 })
    //             },
    //         ]
    //     }),
    // } 
    
    // const content: proto.Message.IInteractiveMessage = {
    //     body: proto.Message.InteractiveMessage.Body.create({text: "This is body"}),
    //     footer: proto.Message.InteractiveMessage.Body.create({text: "this is footer"}),
    //     nativeFlowMessage: {
    //         buttons: [button, button2]
    //     }
    // } 
    const content: proto.Message.IInteractiveMessage = {
        body: proto.Message.InteractiveMessage.Body.create({text: "This is body"}),
        footer: proto.Message.InteractiveMessage.Body.create({text: "this is footer"}),
        nativeFlowMessage: {
            buttons: [button, button2]
        }
    } 
    
    // const content = { 
    //     body: 'this is body', 
    //     footer: 'this is footer', 
    //     nativeFlowMessage: { buttons: [button] } 
    // }
    // const contentReal = makeRealInteractiveMessage(content)
    const contentReal = content

    const interactiveMsg = generateWAMessageFromContent(jid, {
        viewOnceMessage: {
            message: {
                messageContextInfo: {
                    deviceListMetadata: {},
                    deviceListMetadataVersion: 2
                },
                interactiveMessage: proto.Message.InteractiveMessage.create(contentReal)
            }
        }
    }, {} as any)

    console.log(interactiveMsg);

    await wa.sock.sendMessage(jid, {
        messageContextInfo: {
            deviceListMetadata: {},
            deviceListMetadataVersion: 2
        },
        interactiveMessage: proto.Message.InteractiveMessage.create(contentReal)
    } as any)
    // await wa.sock.relayMessage(jid, interactiveMsg.message!, {
    //     messageId: interactiveMsg.key.id!
    // })


    return

    // process.on('SIGINT', async () => {
    //     console.log('\nWait Stopping WA Socket...');
    //     await wa.stopSock()
    //     await delay(1000)
    //     process.exit(0)
    // })

    // while (true) {
    //     console.log('\nSend Message');
    //     // const phone = await question('Enter your phone: ');
    //     const phone = '628884966841';
    //     const type = await question('type: ');
    //     const msg = wa.createMessage()
    //     // const media = prepareWAMessageMedia({
    //     //     image: { 
    //     //         url:  "https://github.com/mengkodingan.png" 
    //     //     } 
    //     // }, {
    //     //     upload: wa.sock.waUploadToServer
    //     // })


    //     if (type === 'btn') {
    //         msg.text('Lorem ipsum')
    //         msg.button('Button 1')
    //     }


    // msg.rawPayload({
    //     body: "Test Carosel " + text,
    //     footer: "test footer",
    //     carouselMessage: {
    //         cards: [
    //             {
    //                 body: 'Slider 1',
    //                 header: {
    //                     title: "HEADER TITLE 1",
    //                     hasMediaAttachment: true,
    //                     ...media
    //                 }
    //             },
    //             {
    //                 body: 'Slider 2',
    //                 header: {
    //                     title: "HEADER TITLE 2",
    //                     hasMediaAttachment: true,
    //                     ...media
    //                 }
    //             }
    //         ]
    //     }
    // } as any)




    // wa.sock.relayMessage('628884966841@s.whatsapp.net', {

    // })

    // await msg.send(phone).then((result) => console.log(result))
    // }
})()
