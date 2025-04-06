import { DataTypes, Model, Sequelize } from "sequelize";
import { DBDriver } from "../drivers/DBDriver";
import { IDBDriver } from "../interfaces/IDBDriver";

export class DataSources extends Model {
  declare id: number;
  declare name: string;
  declare data_type: any;
  declare connection_details: any;
  declare project_id: number;
  declare user_platform_id: number;
}
DBDriver.getInstance().getDriver().then(async (driver: IDBDriver) => {
  await driver.initialize();
  const sequelize = await driver.getConcreteDriver();
  if (sequelize) {
    DataSources.init({
      name: DataTypes.STRING,
      data_type: {
        type: DataTypes.ENUM,
        values: ['excel', 'csv', 'postgresql', 'mysql', 'mariadb', 'mongodb'],
      },
      connection_details: DataTypes.JSONB,
      project_id: DataTypes.STRING,
      user_platform_id: DataTypes.INTEGER,
    }, {
      sequelize,
      modelName: 'DataSources',
      tableName: 'dra_data_sources',
    });
  }
});
