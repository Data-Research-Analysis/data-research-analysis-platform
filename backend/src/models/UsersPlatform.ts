import { Sequelize, DataTypes, Model } from "sequelize";
import { DBDriver } from "../drivers/DBDriver";

export class UsersPlatform extends Model {
  declare id: number;
  declare email: string;
  declare first_name: string;
  declare last_name: string;
  declare password: string;
}
DBDriver.getInstance().getDriver().initialize().then(async () => {
  const sequelize = await DBDriver.getInstance().getDriver().getConcreteDriver();
  if (sequelize) {
    UsersPlatform.init({
      email: DataTypes.STRING,
      first_name: DataTypes.STRING,
      last_name: DataTypes.STRING,
      password: DataTypes.STRING
    }, {
      sequelize,
      modelName: 'UsersPlatform',
      tableName: 'users_platform'
    });
  }
});