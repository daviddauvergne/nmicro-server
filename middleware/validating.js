const Ajv = require('ajv');
const restify = require('restify');

module.exports = function(logger,schema){

	var ajv = new Ajv({allErrors: true});
	var validate = ajv.compile(schema);

	return function (req, res, next) {

		var valid = validate(req.params);
		if (!valid) {
			if(process.env.TESTMODE=='true'){
				logger.debug(req.params);
			}

			return next(new restify.errors.BadRequestError(ajv.errorsText(validate.errors)));
		}

		return next();
	};
};
