import dotenv from 'dotenv';
import { FileDriver } from '../drivers/FileDriver';
import { ITemplateRenderer } from '../interfaces/ITemplateRenderer';

export class TemplateEngineService {
    private static instance: TemplateEngineService;
    private constructor() {}
    public static getInstance(): TemplateEngineService {
        if (!TemplateEngineService.instance) {
            TemplateEngineService.instance = new TemplateEngineService();
        }
        return TemplateEngineService.instance;
    }

    public async initialize() {
        dotenv.config();
        console.log('Initializing Template Engine Service');
    }

    public async render(template_name: string, options: Array<ITemplateRenderer>): Promise<string> {
        await this.initialize();
        return new Promise(async (resolve, reject) => {
            console.log('Rendering template');
            const fileDriver = FileDriver.getInstance().getDriver('html');
            await fileDriver.initialize();
            let content = await fileDriver.read(template_name);
            options.forEach((option) => {
            content = content.replaceAll(`{{${option.key}}}`, option.value);
            });
            return resolve(content);
        });
    }


}