import { IDBDriver } from "../interfaces/IDBDriver.js";
import { UtilityService } from "../services/UtilityService.js";
import { EDataSourceType } from "../types/EDataSourceType.js";
import { MariaDBDriver } from "./MariaDBDriver.js";
import { MySQLDriver } from "./MySQLDriver.js";
import { PostgresDriver } from "./PostgresDriver.js";
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
    public getDriver(driverName: 'excel' | 'csv' | 'postgresql' | 'mysql' | 'mariadb' | 'mongodb'): Promise<IDBDriver> {
        return new Promise<IDBDriver>(async (resolve, reject) => {
            console.log('Getting driver', driverName);
            console.log(driverName === EDataSourceType.POSTGRESQL);
            if (driverName === EDataSourceType.POSTGRESQL) {
                return resolve(PostgresDriver.getInstance());
            } else if (driverName === EDataSourceType.MYSQL) {
                return resolve(MySQLDriver.getInstance());
            } else if (driverName === EDataSourceType.MARIADB) {
                return resolve(MariaDBDriver.getInstance());
            } else if (driverName === EDataSourceType.MONGODB) {

            } else if (driverName === EDataSourceType.CSV) {

            } else if (driverName === EDataSourceType.EXCEL) {

            }

            return resolve(PostgresDriver.getInstance());
        });
    }
}