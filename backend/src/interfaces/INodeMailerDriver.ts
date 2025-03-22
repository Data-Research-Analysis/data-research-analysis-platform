export interface INodeMailerDriver {
    initialize(): Promise<void>;
    sendEmail(to: string, name: string, subject: string, text: string, html: string): Promise<void>;
}