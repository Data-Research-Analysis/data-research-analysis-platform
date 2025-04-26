import { DataTypes, Model } from "sequelize";
import { DBDriver } from "../drivers/DBDriver";
import { VerificationCodes } from "./VerificationCodes";
import { IDBDriver } from "../interfaces/IDBDriver";

export class UsersPlatform extends Model {
  declare id: number;
  declare email: string;
  declare first_name: string;
  declare last_name: string;
  declare password: string;
  declare email_verified_at: Date;
  declare unsubscribe_from_emails_at: Date;
}
DBDriver.getInstance().getDriver().then(async (driver: IDBDriver) => {
  await driver.initialize();
  const sequelize = await driver.getConcreteDriver();
  if (sequelize) {
    UsersPlatform.init({
      email: DataTypes.STRING,
      first_name: DataTypes.STRING,
      last_name: DataTypes.STRING,
      password: DataTypes.STRING,
      email_verified_at: DataTypes.DATE,
      unsubscribe_from_emails_at: DataTypes.DATE,
    }, {
      sequelize,
      modelName: 'UsersPlatform',
      tableName: 'dra_users_platform'
    });
    // UsersPlatform.hasMany(VerificationCodes, {foreignKey: 'user_platforms_id'});
  }
});
