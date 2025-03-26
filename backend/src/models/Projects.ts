import { DataTypes, Model } from "sequelize";
import { DBDriver } from "../drivers/DBDriver";

export class Projects extends Model {
  declare id: number;
  declare name: string;
  declare user_platform_id: number;
}
DBDriver.getInstance().getDriver().initialize().then(async () => {
  const sequelize = await DBDriver.getInstance().getDriver().getConcreteDriver();
  if (sequelize) {
    Projects.init({
      name: DataTypes.STRING,
      user_platform_id: DataTypes.INTEGER,
    }, {
      sequelize,
      modelName: 'Projects',
      tableName: 'projects'
    });
  }
});