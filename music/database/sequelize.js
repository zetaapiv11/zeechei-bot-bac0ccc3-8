const { Sequelize } = require('sequelize');
const path = require('path');

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, 'zeechei_music.db'),
    logging: false,
    define: {
        timestamps: true,
    }
});

module.exports = sequelize;

/*
: ! Aegis !
    + Discord: itsfizys
    + Portfolio: https://itsfiizys.com
    + Community: https://discord.gg/d4RDX4KXc  (Zeechei)
    + for any queries reach out Community or DM me.
*/
