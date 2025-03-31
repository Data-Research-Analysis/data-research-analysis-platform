'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('data_sources', {
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
      data_source_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'data_sources',
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
    await queryInterface.dropTable('data_sources');
  }
};