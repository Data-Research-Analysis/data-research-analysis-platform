'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('columns', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING
      },
      data_type: {
        type: Sequelize.STRING
      },
      data_model_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'data_models',
          key: 'id'
        }
      },
      user_platform_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'users_platform',
          key: 'id'
        }
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('columns');
  }
};