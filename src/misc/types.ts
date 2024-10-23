export type ButtonType = 'cta_url' | 'cta_call' | 'cta_copy' | 'cta_reminder' | 'cta_cancel_reminder' | 'address_message' | 'send_location' | 'quick_reply';

export interface IButtonProps {
    name: ButtonType;
    buttonParamsJson: string;
}

export interface IButtonParams {
    quick_reply: {
        id: string
        display_text: string
    }
    cta_copy: {
        id: string
        copy_code: string
    }
    cta_url: {
        id: string
        url: string
    }
    cta_call: {
        id: string
        call: string // phone number include country code
    }
}

export type ButtonParamsAny = {
    [K in keyof IButtonParams]: IButtonParams[K] extends { id: string } ? Partial<IButtonParams[K]> : never;
}[keyof IButtonParams];


export interface IVCard {
    phone: string
    fullName: string
    org?: string
}
export interface ILocation {
    phone: string
    fullName: string
    org?: string
}