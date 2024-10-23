import EzWhatsapp from "../src/EzWhatsapp"
import { createObjectButtonMessage } from "../src/misc/utils";

(async () => {
    const wa = new EzWhatsapp({
        printQRInTerminal: true,
    })

    await wa.startSock()
    console.log('connecting .....');
    await wa.waitSockConnected()
    console.log('connected!');

    const imgUrl = 'https://placehold.co/300x200?text=Powered+By\nEZ-Whatsapp'


    // use send for only send msg without quoted msg
    wa.respond('!ping', async (ctx) => {
        await ctx.simulateTyping(2_000)
        await ctx.send('pong')
    });

    
    // use reply if send with quoted msg
    wa.respond('!rping', async (ctx) => {
        await ctx.simulateTyping(2_000)
        await ctx.reply('pong')
    });


    // use reply if send with quoted msg
    wa.respond('!image', async (ctx) => {
        const img = await wa.prepareWAMessageMedia({
            image: {url: imgUrl},
        })
        await ctx.reply({
            header: {
                hasMediaAttachment: true,
                ...img
            },
        })
    });


    // use reply if send with quoted msg
    wa.respond('!contact', async (ctx) => {
        await ctx.reply(
            wa.createMessage('contact', [
                {
                    fullName: 'Foo Bazz',
                    phone: '620123456789'
                }
            ]).getPayload()
        )
    });


    // kirim pesan button
    wa.respond('!button', async (ctx) => {
        const msg = wa.createMessage('button')
            .setBody('Gampang Kan?')
            .addButtonReply('Gampang Banget')

        await ctx.reply(msg.getPayload())
    });
    

    // kirim pesan carosel
    wa.respond('!carosel', async (ctx) => {
        const msg = wa.createMessage('carosel')
        msg.setBody('Ini juga gampang buatnya kan?')
        await msg.addCard({
            header: {
                image: imgUrl
            },
            body: 'dengan url', 
            button: createObjectButtonMessage('quick_reply', {
                id: 'btn1',
                display_text: 'Klik Me',
            })
        })
        msg.addCard({
            header: {
                image: await wa.prepareWAMessageMedia({
                    image: { url: imgUrl }
                })
            },
            button: createObjectButtonMessage('quick_reply', {
                id: 'btn1',
                display_text: 'Klik Me',
            })
        })

        await ctx.reply(msg.getPayload())
    });


    // kirim pesan list
    wa.respond('!list', async (ctx) => {
        const msg = wa.createMessage('list')
            .setBody('Gampang banget kan bikinnya?')
            .setButton('Menu')
            .addSection('Bagian 1', [
                {id: '1', title: 'Opsi 1'},
                {id: '2', title: 'Opsi 2'},
            ])
            
        await ctx.reply(msg.getPayload())
    });


    // custom matcher
    wa.respond(async (body, _msg) => {
        if (body.includes('balas')) return true
        return false
    }, async (ctx) => {
        await ctx.reply({
            text: 'oke sudah dibalas ya!'
        })
    });

})()