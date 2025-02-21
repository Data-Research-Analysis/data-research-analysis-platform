import { Sequelize, DataTypes, Model } from "sequelize";
import { PostgresDriver } from "../drivers/PostgresDriver";
import { Utility } from "../utility/Utility";

export class User extends Model {}
PostgresDriver.getInstance().initialize().then(() => {
    const sequelize = PostgresDriver.getInstance().getSequelize();
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

