'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('dra_relationships', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING
      },
      cardinality: {
        type: Sequelize.ENUM('1-1', '1-M', 'M-M')
      },
      local_data_model_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'dra_data_models',
          key: 'id'
        }
      },
      foreign_data_model_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'dra_data_models',
          key: 'id'
        }
      },
      local_column_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'dra_columns',
          key: 'id'
        }
      },
      foreign_column_id: {
        type: Sequelize.INTEGER,
        references: {
          model: 'dra_columns',
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
    await queryInterface.dropTable('dra_relationships');
  }
};