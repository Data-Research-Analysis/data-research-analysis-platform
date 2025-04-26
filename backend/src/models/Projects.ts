import { DataTypes, Model } from "sequelize";
import { DBDriver } from "../drivers/DBDriver";
import { IDBDriver } from "../interfaces/IDBDriver";

export class Projects extends Model {
  declare id: number;
  declare name: string;
  declare user_platform_id: number;
}
DBDriver.getInstance().getDriver().then(async (driver: IDBDriver) => {
  await driver.initialize();
  const sequelize = await driver.getConcreteDriver();
  if (sequelize) {
    Projects.init({
      name: DataTypes.STRING,
      user_platform_id: DataTypes.INTEGER,
    }, {
      sequelize,
      modelName: 'Projects',
      tableName: 'dra_projects'
    });
  }
});