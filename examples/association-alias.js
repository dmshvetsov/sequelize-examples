const _ = require('lodash');
const { Model, Sequelize } = require('sequelize')

/**
 *  Helpers
 */

const modelToObject = model => model.toJSON()

/**
 * Models setup
 */

const initModels = [
  (sequelize, DataTypes) => {
    class Company extends Model {}

    Company.associate = (models) => {
      // Here we use alias earnings for EarningsReport model
      // Note: without specifying model camelCase foreign keys Sequeilize is creating
      // additional foreign key columns in the model with different cases
      Company.hasMany(models.EarningsReport, { as: 'earnings', foreignKey: 'companyId'  });
    }

    Company.init(
      {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        name: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
      },
      {
        sequelize,
        modelName: Company.name,
        underscored: true,
      }
    )

    return Company
  },

  (sequelize, DataTypes) => {
    class EarningsReport extends Model {}

    EarningsReport.associate = (models) => {
      // Note: if this association is defined it should use camelCase foreign keys
      // otherwise Sequeilize is creating additional foreign key props in the model with other cases
      EarningsReport.belongsTo(models.Company, { foreignKey: 'companyId' });
    }

    EarningsReport.init(
      {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        companyId: {
          type: DataTypes.UUID,
          allowNull: false,
          references: {
            model: 'companies',
            key: 'id',
          },
        },
      },
      { sequelize, modelName: EarningsReport.name, underscored: true }
    )

    return EarningsReport
  },
];

/**
 * Main
 */

;(async () => {
  try {
    /**
     * Setup
     */

    const models = {}
    const sequelize = new Sequelize(
      'postgres://postgres:root@localhost:5413/sequelize_examples'
    )

    initModels.forEach((initFn) => {
      const model = initFn(sequelize, Sequelize.DataTypes)
      models[model.name] = model
    })
    Object.keys(models).forEach((modelName) => {
      if (models[modelName].associate) {
        models[modelName].associate(models)
      }
    })
    await sequelize.sync({ force: true })

    /**
     * Use case
     */

    const company = await models.Company.create({ name: 'Dmitry Inc.' })
    await models.EarningsReport.create({ companyId: company.id })
    await models.EarningsReport.create({ companyId: company.id })

    console.log(
      'company earnings:',
      _.map(
          (await models.Company.findOne({
            where: { name: 'Dmitry Inc.' },
            include: 'earnings',
          })).earnings
        , modelToObject
      )
    )

    /**
     * Tear down
     */

    await sequelize.close()
    console.log('DONE')
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
})()

