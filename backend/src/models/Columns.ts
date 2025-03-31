import { DataTypes, Model, Sequelize } from "sequelize";
import { DBDriver } from "../drivers/DBDriver";
import { IDBDriver } from "../interfaces/IDBDriver";

export class Columns extends Model {
  declare id: number;
  declare name: string;
  declare data_type: string;
  declare data_model_id: number;
  declare user_platform_id: number;
}
DBDriver.getInstance().getDriver().then(async (driver: IDBDriver) => {
  await driver.initialize();
  const sequelize = await driver.getConcreteDriver();
  if (sequelize) {
    Columns.init({
      name: DataTypes.STRING,
      data_type: DataTypes.STRING,
      data_model_id: DataTypes.STRING,
      user_platform_id: DataTypes.DATE,
    }, {
      sequelize,
      modelName: 'Columns',
      tableName: 'columns',
    });
  }
});
