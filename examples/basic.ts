import EzWhatsapp from "../src/EzWhatsapp"

(async () => {
    const wa = new EzWhatsapp({
        printQRInTerminal: true,
    })

    await wa.startSock()
    console.log('connecting .....');
    await wa.waitSockConnected()
    console.log('connected!');

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

    // kirim pesan button
    wa.respond('!button', async (ctx) => {
        const msg = wa.createMessage('button')!
            .setBody('Gampang Kan?')
            .addButtonReply('Gampang Banget')

        await ctx.reply(msg.getPayload())
    });


    // custom matcher
    wa.respond(async (body, msg) => {
        if (body.includes('balas')) return true
        return false
    }, async (ctx) => {
        await ctx.reply({
            text: 'oke sudah dibalas ya!'
        })
    });

})()