const crypto = require('crypto');

module.exports = function(password){
	return crypto
		.createHmac(process.env.NMICRO_PASSWORD_HASH,process.env.NMICRO_PASSWORD_SECRET)
		.update(password)
		.digest('hex');
};
