require("dotenv").config();
import { jidDecode, S_WHATSAPP_NET } from "@adiwajshing/baileys";
import { dirname } from "path";
import process from "process";

export const convertToJID = (numberPhoneOrID: string|number, countryCode?: number) => {
  numberPhoneOrID = numberPhoneOrID.toString()
  if (!numberPhoneOrID.includes("@")) {
    numberPhoneOrID.replace(/\D/g, "");
    if (numberPhoneOrID.startsWith('0')) {
      numberPhoneOrID = countryCode + numberPhoneOrID.slice(1)
    }
    numberPhoneOrID += S_WHATSAPP_NET
  }
  return numberPhoneOrID;
};

export const jidToNumberPhone = (jid?: string):string|null => {
  const res = jidDecode(jid);
  return res?.user || null;
};

export const rootPath = (path: string) => {
  return dirname(path) + '|' + process.cwd();
}