import { Sequelize, DataTypes, Model } from "sequelize";
import { DBDriver } from "../drivers/DBDriver";

export class User extends Model {}
DBDriver.getInstance().getDriver().initialize().then(async () => {
    const sequelize = await DBDriver.getInstance().getDriver().getConcreteDriver();
    if (sequelize) {
        User.init({
            email: {
                type: DataTypes.STRING,
                allowNull: false
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false
            },
        },
        {
            sequelize,
            modelName: 'User',
            tableName: 'users',
        }
        );
    }
});

