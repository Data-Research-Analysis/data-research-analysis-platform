import { DataTypes, Model } from "sequelize";
import { DBDriver } from "../drivers/DBDriver";

export class VerificationCodes extends Model {
  declare id: number;
  declare code: string;
  declare user_platform_id: number;
  declare expired_at: Date;
}
DBDriver.getInstance().getDriver().initialize().then(async () => {
  const sequelize = await DBDriver.getInstance().getDriver().getConcreteDriver();
  if (sequelize) {
    VerificationCodes.init({
      code: DataTypes.STRING,
      user_platform_id: DataTypes.INTEGER,
      expired_at: DataTypes.DATE,
    }, {
      sequelize,
      modelName: 'VerificationCodes',
      tableName: 'verification_codes'
    });
  }
});