import { GroupMetadata, ParticipantAction, proto, WASocket } from "@whiskeysockets/baileys";
import Client from "./client";

export type memberJID = string

export default class Group {
    private client: Client

    constructor(client: Client) {
        this.client = client
    }

    get sock(): WASocket {
        return this.client.sock
    }

    async create(subject: string, members: memberJID[]): Promise<GroupMetadata> {
        return await this.sock.groupCreate(subject, members);
    }

    async inviteCodeInfo(code: string): Promise<GroupMetadata> {
        return await this.sock.groupGetInviteInfo(code);
    }

    async acceptInvite(code: string): Promise<string | undefined> {
        return await this.sock.groupAcceptInvite(code);
    }
    
    async acceptInviteV4(key: string | proto.IMessageKey, inviteMessage: proto.Message.IGroupInviteMessage): Promise<string> {
        return await this.sock.groupAcceptInviteV4(key, inviteMessage);
    }

    /**
     * Update description of wa group
     */
    async updateDescription(groupJid: string, description?: string): Promise<void> {
        return await this.sock.groupUpdateDescription(groupJid, description);
    } 

    /**
     * Update name of wa group
     * @param subject group name
     * @returns 
     */
    async updateSubject(groupJid: string, subject: string): Promise<void> {
        return await this.sock.groupUpdateSubject(groupJid, subject);
    }

    async updateSetting(idGroup: string, settingOption: GroupSettingOption|GroupSettingOptionValue) {
        await this.sock.groupSettingUpdate(idGroup, settingOption)
    }


    async membersUpdate(groupJid: string, members: memberJID[], action: ParticipantAction) {
        return await this.sock.groupParticipantsUpdate(groupJid, members, action)
    }

    kick(groupJid: string, members: memberJID[]) {
        return this.membersUpdate(groupJid, members, 'remove');
    }

    add(groupJid: string, members: memberJID[]) {
        return this.membersUpdate(groupJid, members, 'add');
    }

    promote(groupJid: string, members: memberJID[]) {
        return this.membersUpdate(groupJid, members, 'promote');
    }

    demote(groupJid: string, members: memberJID[]) {
        return this.membersUpdate(groupJid, members, 'demote');
    }
    
    leave(groupJid: string) {
        return this.sock.groupLeave(groupJid) // (will throw error if it fails)
    }
}

enum GroupSettingOption {
    // only allow admins to send messages
    ANNOUNCEMENT = 'announcement',
    // allow everyone to send messages
    NON_ANNOUNCEMENT = 'not_announcement',
    // allow everyone to modify the group's settings -- like display picture etc.
    UNLOCKED = 'unlocked',
    // only allow admins to modify the group's settings
    LOCKED = 'locked',
}
type GroupSettingOptionValue = `${GroupSettingOption}`
