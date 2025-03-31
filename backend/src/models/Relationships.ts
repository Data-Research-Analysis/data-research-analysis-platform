import { DataTypes, Model, Sequelize } from "sequelize";
import { DBDriver } from "../drivers/DBDriver";
import { IDBDriver } from "../interfaces/IDBDriver";

export class Relationships extends Model {
  declare id: number;
  declare name: string;
  declare cardinality: any;
  declare local_data_model_id: number;
  declare foreign_data_model_id: number;
  declare local_column_id: number;
  declare foreign_column_id: number;
  declare user_platform_id: number;
}
DBDriver.getInstance().getDriver().then(async (driver: IDBDriver) => {
  await driver.initialize();
  const sequelize = await driver.getConcreteDriver();
  if (sequelize) {
    Relationships.init({
      name: DataTypes.STRING,
      cardinality: DataTypes.ENUM,
      local_data_model_id: DataTypes.INTEGER,
      foreign_data_model_id: DataTypes.INTEGER,
      local_column_id: DataTypes.INTEGER,
      foreign_column_id: DataTypes.INTEGER,
      user_platform_id: DataTypes.DATE,
    }, {
      sequelize,
      modelName: 'Relationships',
      tableName: 'relationships',
    });
  }
});
