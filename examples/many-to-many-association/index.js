const { Model, Sequelize } = require('sequelize')

/**
 * Models
 */

const initModels = [
  (sequelize, DataTypes) => {
    class User extends Model {}

    User.associate = (models) => {
      User.belongsToMany(models.Role, { through: models.UserRole, foreignKey: 'role_id' })
    }

    User.init(
      {
        username: DataTypes.STRING,
        password: DataTypes.STRING,
      },
      { sequelize, modelName: 'User', underscored: true }
    )

    return User
  },
  (sequelize, DataTypes) => {
    class Role extends Model {}

    Role.associate = (models) => {
      Role.belongsToMany(models.User, { through: models.UserRole, foreignKey: 'user_id' })
    }

    Role.init(
      {
        name: DataTypes.STRING,
      },
      { sequelize, modelName: 'Role', underscored: true }
    )

    return Role
  },
  (sequelize, DataTypes) => {
    class UserRole extends Model {}

    UserRole.init(
      {},
      { sequelize, modelName: 'UserRole', timestamps: false, underscored: true }
    )

    return UserRole
  }
];

/**
 * Queries
 */

(async () => {
  try {
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

    const adminRole = await models.Role.create({ name: 'Admin' })
    const managerRole = await models.Role.create({ name: 'Manager' })
    const admin = await models.User.create({ username: 'admin', password: 'secure' })
    await admin.setRoles([adminRole, managerRole])
    const userRoles = await models.UserRole.findAll()
    console.log(userRoles.map(userRole => userRole.toJSON()))

    await sequelize.close()
    console.log('DONE')
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
})()
