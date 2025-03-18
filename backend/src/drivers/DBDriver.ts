import { IDBDriver } from "../interfaces/IDBDriver";
import { UtilityService } from "../services/UtilityService";
import { PostgresDriver } from "./PostgresDriver";
import dotenv from 'dotenv';

export class DBDriver {
    private static instance: DBDriver;
    private constructor() {
    }
    public static getInstance(): DBDriver {
        if (!DBDriver.instance) {
            DBDriver.instance = new DBDriver();
        }
        return DBDriver.instance;
    }

    //This is a factory method to get the relevant driver
    public getDriver(): IDBDriver {
        const dbDriver = UtilityService.getInstance().getConstants('DB_Driver');
        if (dbDriver === 'postgres') {
            return PostgresDriver.getInstance();
        }
        return null;
    }
   
}