import { Sequelize, DataTypes, Model } from "sequelize";
import { PostgresDriver } from "../drivers/PostgresDriver";

export class UsersPlatform extends Model {
  declare id: number;
  declare email: string;
  declare first_name: string;
  declare last_name: string;
  declare password: string;
}
PostgresDriver.getInstance().initialize().then(() => {
  const sequelize = PostgresDriver.getInstance().getDriver();
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