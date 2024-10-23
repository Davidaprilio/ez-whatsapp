import { AnyRegularMessageContent, proto } from "@whiskeysockets/baileys";
import { IVCard } from "src/misc/types";
import { createVCardFormat } from "src/misc/utils";

export interface IVCardMessage {
    contacts: proto.Message.IContactMessage[]
}

export class VCardMessage {
    private options: IVCardMessage

    constructor(contacts?: IVCard[]) {
        if (contacts) {
            contacts.forEach(contact => this.add(contact))
        }
    }

    add(props: IVCard) {
        this.options.contacts.push({
            displayName: props.fullName,
            vcard: createVCardFormat(props)
        })
    }


    getPayload(): AnyRegularMessageContent {
        return {
            contacts: {
                displayName: this.options.contacts[0]?.displayName ?? undefined,
                contacts: []
            }
        }
    }
}