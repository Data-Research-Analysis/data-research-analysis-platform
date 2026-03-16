import { DBDriver } from "../drivers/DBDriver.js";
import { ITokenDetails } from "../types/ITokenDetails.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { DRAUsersPlatform } from "../models/DRAUsersPlatform.js";
import { DRAEnterpriseQuery } from "../models/DRAEnterpriseQuery.js";
import { IEnterpriseQuery } from "../types/IEnterpriseQuery.js";
import { EmailService } from "../services/EmailService.js";

export class EnterpriseQueryProcessor {
    private static instance: EnterpriseQueryProcessor;
    private constructor() {}

    public static getInstance(): EnterpriseQueryProcessor {
        if (!EnterpriseQueryProcessor.instance) {
            EnterpriseQueryProcessor.instance = new EnterpriseQueryProcessor();
        }
        return EnterpriseQueryProcessor.instance;
    }

    async getEnterpriseQueries(tokenDetails: ITokenDetails): Promise<IEnterpriseQuery[]> {
        return new Promise<IEnterpriseQuery[]>(async (resolve, reject) => {
            const { user_id } = tokenDetails;
            let driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
            if (!driver) {
                return resolve([]);
            }
            const manager = (await driver.getConcreteDriver()).manager;
            if (!manager) {
                return resolve([]);
            }
            const user = await manager.findOne(DRAUsersPlatform, {where: {id: user_id}});
            if (!user) {
                return resolve([]);
            }
            const queriesList: IEnterpriseQuery[] = [];
            const queries = await manager.find(DRAEnterpriseQuery);
            for (let i = 0; i < queries.length; i++) {
                const query = queries[i];
                
                // Check if query email exists in main users table
                const existingUser = await manager.findOne(DRAUsersPlatform, {
                    where: { email: query.business_email }
                });
                
                queriesList.push({
                    id: query.id,
                    first_name: query.first_name,
                    last_name: query.last_name,
                    business_email: query.business_email,
                    phone_number: query.phone_number,
                    country: query.country,
                    agree_to_receive_updates: query.agree_to_receive_updates,
                    company_name: query.company_name,
                    created_at: query.created_at,
                    is_converted: existingUser ? true : false,
                    converted_user_id: existingUser ? existingUser.id : null,
                });
            }
            return resolve(queriesList);
        });
    }

    /**
     * Submit enterprise inquiry.
     * Returns alreadyExists true if email already registered, or creates new inquiry record.
     * Sends notification emails to admin and confirmation to user.
     */
    public async submitEnterpriseInquiry(fields: {
        first_name: string; last_name: string; phone_number: string;
        business_email: string; company_name: string;
        agree_to_receive_updates: boolean; country: string;
    }): Promise<{ alreadyExists: boolean; email: string }> {
        const { DBDriver } = await import('../drivers/DBDriver.js');
        const { EDataSourceType } = await import('../types/EDataSourceType.js');
        const { DRAEnterpriseQuery } = await import('../models/DRAEnterpriseQuery.js');
        const driver = await DBDriver.getInstance().getDriver(EDataSourceType.POSTGRESQL);
        const manager = (await driver.getConcreteDriver()).manager;
        const existing = await manager.findOne(DRAEnterpriseQuery, { where: { business_email: fields.business_email } });
        if (existing) return { alreadyExists: true, email: fields.business_email };
        const query = new DRAEnterpriseQuery();
        query.first_name = fields.first_name;
        query.last_name = fields.last_name;
        query.phone_number = fields.phone_number;
        query.business_email = fields.business_email;
        query.company_name = fields.company_name;
        query.agree_to_receive_updates = fields.agree_to_receive_updates;
        query.country = fields.country;
        await manager.save(query);
        
        // Send notification emails (non-blocking)
        try {
            // Send admin notification
            EmailService.getInstance().sendEnterpriseInquiryNotificationToAdmin({
                firstName: fields.first_name,
                lastName: fields.last_name,
                businessEmail: fields.business_email,
                phoneNumber: fields.phone_number,
                companyName: fields.company_name,
                country: fields.country,
                agreeToReceiveUpdates: fields.agree_to_receive_updates,
                submittedAt: new Date()
            }).catch(error => {
                console.error('[EnterpriseQueryProcessor] Failed to send admin notification email:', error);
            });
            
            // Send user confirmation
            EmailService.getInstance().sendEnterpriseInquiryConfirmationToUser({
                firstName: fields.first_name,
                businessEmail: fields.business_email,
                companyName: fields.company_name
            }).catch(error => {
                console.error('[EnterpriseQueryProcessor] Failed to send user confirmation email:', error);
            });
        } catch (error) {
            console.error('[EnterpriseQueryProcessor] Error sending enterprise inquiry emails:', error);
            // Don't fail the inquiry submission if emails fail
        }
        
        return { alreadyExists: false, email: fields.business_email };
    }
}
