import { DBDriver } from "../drivers/DBDriver";
import { UtilityService } from "../services/UtilityService";
import jwt, { JwtPayload } from "jsonwebtoken";
import { IDBConnectionDetails } from "../types/IDBConnectionDetails";
import { Sequelize } from "sequelize";

export class DataSourceProcessor {
    private static instance: DataSourceProcessor;
    private constructor() {}

    public static getInstance(): DataSourceProcessor {
        if (!DataSourceProcessor.instance) {
            DataSourceProcessor.instance = new DataSourceProcessor();
        }
        return DataSourceProcessor.instance;
    }

    public async connectToDataSource(connection: IDBConnectionDetails): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            console.log('Connecting to external DB', connection);
            const driver = await DBDriver.getInstance().getDriver();
            if (driver) {
                const response: boolean = await driver.initialize();
                if (response) {
                    const externalDriver = await DBDriver.getInstance().getDriver();
                    const dbConnector: Sequelize =  await externalDriver.connectExternalDB(connection);
                    if (dbConnector) {
                        return resolve(true);
                    }
                    return resolve(false);
                }
                return resolve(false);
            }
            return resolve(false);
        });
    }



}