import { Sequelize, DataTypes, Model } from "sequelize";
import { DBDriver } from "../drivers/DBDriver";
import { IDBDriver } from "../interfaces/IDBDriver";

export class User extends Model {}
DBDriver.getInstance().getDriver().then(async (driver: IDBDriver) => {
  await driver.initialize();
  const sequelize = await driver.getConcreteDriver();
    if (sequelize) {
        User.init({
            email: {
                type: DataTypes.STRING,
                allowNull: false
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false
            },
        },
        {
            sequelize,
            modelName: 'User',
            tableName: 'users',
        }
        );
    }
});

