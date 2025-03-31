import { DataTypes, Model, Sequelize } from "sequelize";
import { DBDriver } from "../drivers/DBDriver";
import { IDBDriver } from "../interfaces/IDBDriver";

export class DataModels extends Model {
  declare id: number;
  declare schema: string;
  declare name: string;
  declare data_source_id: number;
  declare user_platform_id: number;
}
DBDriver.getInstance().getDriver().then(async (driver: IDBDriver) => {
  await driver.initialize();
  const sequelize = await driver.getConcreteDriver();
  if (sequelize) {
    DataModels.init({
      schema: DataTypes.STRING,
      name: DataTypes.STRING,
      data_source_id: DataTypes.STRING,
      user_platform_id: DataTypes.DATE,
    }, {
      sequelize,
      modelName: 'DataModels',
      tableName: 'data_models',
    });
  }
});
