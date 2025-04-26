'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add seed commands here.
     *
     * Example:
     * await queryInterface.bulkInsert('People', [{
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
    */

    const connection = {
            host: 'database.dataresearchanalysis.test',
            port: '5432',
            schema: 'public',
            database: 'postgres_dra_db',
            user: 'postgres',
            password: 'postgres',
        };
    await queryInterface.bulkInsert('dra_data_sources', [{
      name: 'postgresql',
      connection_details: JSON.stringify(connection),
      data_type: 'postgresql',
      project_id: 1,
      user_platform_id: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
    await queryInterface.bulkDelete('dra_data_sources', null, {});
  }
};
