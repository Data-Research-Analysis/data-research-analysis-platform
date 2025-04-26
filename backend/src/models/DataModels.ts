import { DataTypes, Model, Sequelize } from "sequelize";
import { DBDriver } from "../drivers/DBDriver";
import { IDBDriver } from "../interfaces/IDBDriver";

export class DataModels extends Model {
  declare id: number;
  declare schema: string;
  declare name: string;
  declare sql_query: string;
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
      sql_query: DataTypes.TEXT,
      data_source_id: DataTypes.INTEGER,
      user_platform_id: DataTypes.INTEGER,
    }, {
      sequelize,
      modelName: 'DataModels',
      tableName: 'dra_data_models',
    });
  }
});
