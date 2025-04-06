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
    await queryInterface.bulkInsert('dra_projects', [{
      name: 'Atilus1',
      user_platform_id: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }, {
      name: 'Atilus2',
      user_platform_id: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    }, {
      name: 'Atilus3',
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
    await queryInterface.bulkDelete('dra_projects', null, {});
  }
};
