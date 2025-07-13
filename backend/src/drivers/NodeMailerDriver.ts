import { INodeMailerDriver } from "../interfaces/INodeMailerDriver.js";
import nodemailer, { SentMessageInfo, Transporter } from 'nodemailer';
import { UtilityService } from "../services/UtilityService.js";
import { Options } from "nodemailer/lib/smtp-transport/index.js";

export class NodeMailerDriver implements INodeMailerDriver {
    private static instance: NodeMailerDriver;
    private transport!: Transporter<SentMessageInfo, Options>;
    private constructor() {
    }
    public static getInstance(): NodeMailerDriver {
        if (!NodeMailerDriver.instance) {
            NodeMailerDriver.instance = new NodeMailerDriver();
        }
        return NodeMailerDriver.instance;
    }
    public async initialize(): Promise<void> {
        return new Promise(async (resolve, reject) => {
            console.log('Initializing Mailtrap');
            this.transport = nodemailer.createTransport({
                host: UtilityService.getInstance().getConstants('MAIL_HOST'),
                port: UtilityService.getInstance().getConstants('MAIL_PORT'),
                auth: {
                user: UtilityService.getInstance().getConstants('MAIL_USER'),
                pass: UtilityService.getInstance().getConstants('MAIL_PASS'),
                }
            });
            return resolve();
        });
    }
    public async sendEmail(to: string, name: string, subject: string, text: string, html: string): Promise<void> {
        return new Promise(async (resolve, reject) => {
            console.log('Sending email using Mailtrap');
            const from = UtilityService.getInstance().getConstants('MAIL_FROM');
            const replyTo = UtilityService.getInstance().getConstants('MAIL_REPLY_TO');
            
            if (this.transport) {
                const response = await this.transport.sendMail({
                    from: `"Data Research Analysis" <${from}>`,
                    to: to,
                    replyTo: replyTo,
                    subject: subject,
                    text: text,
                    html: html,
                })   
            }
            return resolve();
        });
    }
}