import { DataTypes, Model } from "sequelize";
import { DBDriver } from "../drivers/DBDriver";
import { VerificationCodes } from "./VerificationCodes";

export class UsersPlatform extends Model {
  declare id: number;
  declare email: string;
  declare first_name: string;
  declare last_name: string;
  declare password: string;
  declare email_verified_at: Date;
  declare unsubscribe_from_emails_at: Date;
}
DBDriver.getInstance().getDriver().initialize().then(async () => {
  const sequelize = await DBDriver.getInstance().getDriver().getConcreteDriver();
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
      tableName: 'users_platform'
    });
    // UsersPlatform.hasMany(VerificationCodes, {foreignKey: 'user_platforms_id'});
  }
});
