import { convertToJID } from "../src/helper";
// import { OptionSection } from "./message/list";
import Whatsapp, { Client } from "../src/Whatsapp";

const wa: Whatsapp = new Whatsapp('david-14A', {
    browser: Client.Opera
});

(async () => {
    console.log('Starting Socket');
    await wa.startSock()
    console.log('Socket Started');

    wa.on('sock.connected', (info) => {
        console.log('WES KONEK =======================', info);

        setTimeout(async () => {
			const jid = convertToJID('085231028718')
			// const jid = '120363024101903992@g.us' // group
			const isRegister = await wa.isRegistWA(jid);
			console.log('isRegister', isRegister);
			if (isRegister) {
                const msg = wa.createMessage(typeMsg? = basic)
                // Make Text message
				msg.header('type', {
                    url: 'as'
                })
				msg.title('WA Tersambung')
				msg.body([
                    'hello',
                    '1. ',
                    '2. ',
                ])
				msg.footer('WA Tersambung')
				msg.send(jid)
                msg.reply()
                
                // Make button message
                const msgBtn = wa.createButtonMessage()
				msgBtn
                    .header()
                    .title()
                    .body()
                    .footer()
                    .addButtonReplay('Footer Message', 'id')
                    .addButtonUrl('http', 'id')
                    .addButtonMerchant('http', 'id')
                    .addButtonCopy('123456', 'id')
                    .addButton('type', {
                        ...options
                    })
                    .getPayload()
                    .send(jid, {replyMsgId: ''})
                    .reply(msg)
					// .image('https://www.w3schools.com/tags/smiley.gif') // belum bisa
					// .add('Button 1')
					// .add('Button 2')
					// .add('Button 3');

                // Make List Message
                const listMsg = wa.createListMessage()
                    .header()
                    .title()
                    .body()
                    .footer()
                    .addSection('Section 1', (section: OptionSection) => {
                        section.option('option1', 'Option 1')
                        section.option('option2', 'Option 2', 'Option description')
                    })
                listMsg.addSection('Section 2')
                    .addOption('option1', 'Option 1')
                    .addOption('option2', 'Option 2', 'Option description')

                // Make Template Message
                // msg.template('Pesan Template')
                //     .urlButton('Portofolio', 'https://github.com/Davidaprilio')
                //     .callButton('Hubungi Saya', '085231028718')
                //     .replyButton('Salam Kenal', 'salam')

                // Reaction
                // msg.reaction({
                //     remoteJid: jid,
                //     fromMe: false,
                //     id: 'E25C4455AEEA414DA7215BBD194A6F31'
                // }, '👍')

                // msg.location(-7.655931370631908, 111.97003735003399)                

                // msg.contact('david')
                //     .add('David Aprilio', '085231028718', 'MSD')
                //     .add('Alwi Bayu P', '026156281222', 'STAN (Kediri)')
	
				// msg.send(jid)

                setTimeout(() => {
                    process.exit(1)
                }, 60_000);
			}
        }, 5_000);
    })

    wa.on('sock.disconnected', (reasonInfo: object) => {
        console.log('Koneksi Terputus', reasonInfo);
    })

    wa.on('sock.connecting', () => {
        console.log('Menyambungkan Ulang');
    })

    wa.on('qr.stoped', (data) => {
        if (data.state == 'expired') {
            console.log('upaya menyambungkan QR habis');
        } else {
            console.log('QR code telah berhenti');
        }
    })

    wa.on('msg.incoming', (data) => {
        const message = data.message;
        const isFromMe = message.key.fromMe;
        const isFromGroup = message.key.remoteJid?.endsWith('@g.us') || false;
        const { jid, messageID } = data.messageData

        console.log(
            {
                message, isFromMe, isFromGroup, jid, messageID
            }
        );

        // msg.reaction({
        //     remoteJid: message.key.remoteJid,
        //     fromMe: false,
        //     id: message.key.id
        // }, '👍')

        const messageText = message.message?.conversation || null
        if (typeof messageText === 'string' && messageText.startsWith('#')) {
            if(isFromGroup) {
                if (messageText === '#info:id') {
                    const msg = wa.createMessage();
                    msg.text([
                        'ID group dari',
                        message.key.remoteJid
                    ].join('\n'))

                    msg.reply(message)
                    // msg.send(message.key.remoteJid || '')
                }
            }
        }
    })

    wa.on('qr.update', (data) => {
        console.log('QR Update', data);
    })

})()

