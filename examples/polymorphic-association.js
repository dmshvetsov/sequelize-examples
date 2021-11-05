const _ = require('lodash')
const { Model, Sequelize } = require('sequelize')

/**
 * Models setup
 */

const AccountTypes = Object.freeze({
  bankAccount: 'BankAccount',
  card: 'Card',
})

const initModels = [
  (sequelize, DataTypes) => {
    class Account extends Model {
      static get detailsAssociations() {
        return Object.values(AccountTypes).map(accType => `${_.camelCase(accType)}Details`);
      }

      getDetails(options) {
        if (this.type === 'BankAccount') {
          return this.getBankAccountDetails(options)
        }
        if (this.type === 'Card') {
          return this.getCardDetails(options)
        }
        return Promise.resolve(null)
      }

      toJSON() {
        const plainObj = super.toJSON();
        Account.detailsAssociations.forEach((assocName) =>
          Reflect.deleteProperty(plainObj, assocName)
        )
        if (plainObj.details && plainObj.details.toJSON) {
          plainObj.details = plainObj.details.toJSON();
        }
        return plainObj;
      }
    }

    Account.associate = (models) => {
      Object.values(AccountTypes).forEach((accType) =>
        Account.belongsTo(models[`${_.upperFirst(_.camelCase(accType))}Details`], {
          as: `${_.camelCase(accType)}Details`,
          foreignKey: 'details_id',
        })
      )
    }

    Account.init(
      {
        detailsId: {
          type: DataTypes.INTEGER,
        },
        type: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        details: {
          type: DataTypes.VIRTUAL,
          get() {
            return this.bankAccountDetails || this.cardDetails;
          }
        },
      },
      {
        sequelize,
        modelName: 'Account',
        underscored: true,
        scopes: {
          withDetails: {
            include: Account.detailsAssociations,
          },
        },
        hooks: {
          afterFind: (findResult) => {
            if (!Array.isArray(findResult)) {
              findResult = [findResult]
            }
            findResult.forEach((instance) => {
              Account.detailsAssociations.forEach((assocName) => {
                if (instance[assocName]) {
                  instance.details = instance[assocName]
                }
                Reflect.deleteProperty(instance, assocName)
                Reflect.deleteProperty(instance, `dataValues.${assocName}`)
              })
            })
          },
        },
      }
    )


    return Account
  },

  (sequelize, DataTypes) => {
    class BankAccountDetails extends Model {}

    BankAccountDetails.associate = (models) => {
      BankAccountDetails.hasMany(models.Account, { foreignKey: 'details_id' })
    }

    BankAccountDetails.init(
      {
        bankName: DataTypes.TEXT,
        last4: DataTypes.TEXT,
        routingNumber: DataTypes.TEXT,
      },
      { sequelize, modelName: 'BankAccountDetails', underscored: true }
    )

    return BankAccountDetails
  },

  (sequelize, DataTypes) => {
    class CardDetails extends Model {}

    CardDetails.associate = (models) => {
      CardDetails.hasMany(models.Account, { foreignKey: 'details_id' })
    }

    CardDetails.init(
      {
        providerName: DataTypes.TEXT,
        last4: DataTypes.TEXT,
        expiration: DataTypes.TEXT,
      },
      { sequelize, modelName: 'CardDetails', underscored: true }
    )

    return CardDetails
  },
];

/**
 * Main
 */

(async () => {
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
    Object.keys(models).forEach(modelName => {
      if (models[modelName].associate) {
        models[modelName].associate(models);
      }
    });
    await sequelize.sync({ force: true })

    /**
     * Use case
     */

    const bankAccount = await models.Account.create({
      type: 'BankAccount',
      bankAccountDetails: {
        bankName: 'ABC',
        last4: '4444',
        routingNumber: '000111000',
      },
    }, {
      include: [{
        association: 'bankAccountDetails',
      }]
    });
    console.log('created bank account json:', bankAccount.toJSON())

    const cardAccount = await models.Account.create(
      {
        type: AccountTypes.card,
        cardDetails: {
          providerName: 'Mastercard',
          last4: '1234',
          expiration: '03/24',
        },
      },
      {
        include: [
          {
            association: 'cardDetails',
          },
        ],
      }
    )
    console.log('created card account json:', cardAccount.toJSON())

    const accountsWithDetails = await models.Account.scope('withDetails').findAll({ raw: true, nest: true });
    console.log(accountsWithDetails)


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
