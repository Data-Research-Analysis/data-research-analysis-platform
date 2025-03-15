import { Sequelize, DataTypes, Model } from "sequelize";
import { PostgresDriver } from "../drivers/PostgresDriver";

export class User extends Model {}
PostgresDriver.getInstance().initialize().then(() => {
    const sequelize = PostgresDriver.getInstance().getDriver();
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

