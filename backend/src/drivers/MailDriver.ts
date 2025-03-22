import { INodeMailerDriver } from "../interfaces/INodeMailerDriver";
import { UtilityService } from "../services/UtilityService";
import { NodeMailerDriver } from "./NodeMailerDriver";

export class MailDriver {
    private static instance: MailDriver;
    private constructor() {
    }
    public static getInstance(): MailDriver {
        if (!MailDriver.instance) {
            MailDriver.instance = new MailDriver();
        }
        return MailDriver.instance;
    }
    public getDriver(): INodeMailerDriver {
        return NodeMailerDriver.getInstance();
    }
}