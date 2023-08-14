import { AnyRegularMessageContent, proto } from "@whiskeysockets/baileys";
import Whatsapp from "../Whatsapp";
import MessageButton from "./button";
import MessageContact from "./contact";
import MessageList from "./list";
import MessageTemplateButton from "./template";
// import Whatsapp from "./Whatsapp";

export type Button = proto.Message.ButtonsMessage.IButton;
export type NullableString = string | null

export default class Message {
	private client: Whatsapp;
	private msTimeTyping: number;
	private toPhones: string[] = [];
	private skeletonPayloads: any[] = [];
	private payloads: AnyRegularMessageContent[] = []

	constructor(client: Whatsapp, msTimeTyping: number = 0) {
		this.client = client
		this.msTimeTyping = msTimeTyping
	}

	resetPayloads() {
		this.payloads = []
	}

	resetPhones() {
		this.toPhones = []
	}

	text(text: string): void {
		this.makePayloadObject({
			text
		})
	}

	button(text: string, footer: NullableString = null): MessageButton {
		const btn = new MessageButton()
		btn.text(text)
		if (footer) btn.footer(footer)
		return this.next(btn)
	}

	contact(displayName: string = ''): MessageContact {
		const msgContact = new MessageContact()
		msgContact.setDisplayName(displayName)
		return this.next(msgContact)
	}

	template(text: string, footer?: string): MessageTemplateButton {
		const templateBtn = new MessageTemplateButton()
		templateBtn.text(text)
		if (footer) templateBtn.footer(footer)
		return this.next(templateBtn)
	}

	list(titleMsg: NullableString, textMsg: string, footerMsg: NullableString = null): MessageList {
		const msgList = new MessageList()
		msgList.text(textMsg)
		if (footerMsg) msgList.footer(footerMsg)
		if (titleMsg) msgList.title(titleMsg)
		return this.next(msgList)
	}
	
	/**
	 * Send Reaction with emoji
	 * 
	 * @param messageKey message id or message Key
	 * @param emotReaction use an empty string or null to remove the reaction
	 */
	reaction(messageKey: proto.IMessageKey, emotReaction: NullableString) {
		this.makePayloadObject({
			react: {
				text: emotReaction === null ? '' : emotReaction,
				key: messageKey
			}
		})
	}

	/**
	 * Send Location with coordinates
	 */
	location(latitude: number, longitude: number) {
		this.makePayloadObject({ 
			location: { 
				degreesLatitude: latitude, 
				degreesLongitude: longitude 
			} 
		}) 
	}

	video(linkUrl: string, caption: string, asGIF: boolean = false) {
		this.makePayloadObject({ 
			video: linkUrl, 
			caption,
			gifPlayback: asGIF
		})
	}
	image(linkUrl: string, caption: string, jpegThumbnailBase64?: string) {
		this.makePayloadObject({
			caption,
			image: {
				url: linkUrl
			},
			jpegThumbnail: jpegThumbnailBase64
		})
	}
	audio(linkUrl: string, asVoiceNotes: boolean = false) {
		this.makePayloadObject({ 
			audio: { 
				url: linkUrl 
			}, 
			mimetype: 'audio/mp4', 
			ptt: asVoiceNotes,
		})
	}
	voice(linkUrl: string) {
		this.audio(linkUrl, true)
	}
	document(linkUrl: string) {
		this.makePayloadObject({
			url: linkUrl
		})
	}

	/**
	 * Make raw Baileys message payload
	 * you can insert raw object MessageContext
	 *  
	 * @param payloadMessageContent 
	 */
	rawPayload(payloadMessageContent: object): void {
		this.makePayloadObject(
			payloadMessageContent
		)
	}

	private makePayloadObject(object: object) {
		this.next({
			getPayload() {
				return object
			}
		})
	}

	/**
	 * Push payloads object and return instance class 
	 * @param classObject 
	 * @returns 
	 */
	private next(classObject: any) {
		this.skeletonPayloads.push(classObject)
		return classObject
	}

	private buildPayload() {
		this.payloads = []
		this.skeletonPayloads.forEach((payload) => {
			this.payloads.push(payload.getPayload())
		})
	}

	dumpPayload() {
		this.buildPayload()
		console.log(this.payloads);
	}
	
	getPayloads(index?: number) {
		this.buildPayload()
		return index === undefined
			? this.payloads
			: this.payloads[index]
	}

	to(jid: string) {
		this.toPhones.push(jid)
	}

	reply(message: proto.IWebMessageInfo) {
		if (message.key.remoteJid === null || message.key.remoteJid === undefined) {
			this.client.logger.info(message.key)
			throw new Error("Reply Message but JID Not Found");
		}
		this.buildPayload()
		this.skeletonPayloads = []
		this.sendMessageExec(message.key.remoteJid, message)
	}

	/**
	 * Execute Sending Message
	 * 
	 * @param jidOrNumberPhone jid wa or phone number with country code
	 */
	async send(jidOrNumberPhone?: string) {
		this.buildPayload()
		this.skeletonPayloads = []
		if (jidOrNumberPhone) {
			return await this.sendMessageExec(jidOrNumberPhone)
		} else {
			const res: any = {}
			for (const phone of this.toPhones) {
				res[phone] = await this.sendMessageExec(phone)
			}
			return res
		}
	}

	/**
	 * Execute Sending Message
	 * the more payload and phone, the longer the sending process
	 * @param jid jid wa or phone
	 * @returns response from wa
	 */
	private async sendMessageExec(jid: string, replyMessage?: proto.IWebMessageInfo) {
		this.client.logger.info('sendTo:', jid);
		const res = [];

		for (const payload of this.payloads) {
			const resClient = await this.client.sendMessageWithTyping(
				jid, 
				payload, 
				replyMessage, 
				this.msTimeTyping	
			)
			this.client.logger.info('RES WA', resClient);

			res.push(resClient)
		}
		return res
	}
}