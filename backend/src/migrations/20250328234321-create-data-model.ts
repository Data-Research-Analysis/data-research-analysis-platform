'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('dra_data_models', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      schema: {
        type: Sequelize.STRING
      },
      name: {
        type: Sequelize.STRING
      },
      sql_query: {
        type: Sequelize.TEXT
      },
      data_source_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'dra_data_sources',
          key: 'id'
        }
      },
      user_platform_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'dra_users_platform',
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
    await queryInterface.dropTable('dra_data_models');
  }
};