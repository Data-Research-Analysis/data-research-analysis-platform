import { INodeMailerDriver } from "../interfaces/INodeMailerDriver.js";
import { UtilityService } from "../services/UtilityService.js";
import { NodeMailerDriver } from "./NodeMailerDriver.js";

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