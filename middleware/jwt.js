const jsonwebtoken = require('jsonwebtoken');
const passport = require("passport");
const passportJWT = require("passport-jwt");

var ExtractJwt = passportJWT.ExtractJwt;
var JwtStrategy = passportJWT.Strategy;

module.exports = function(logger,redis) {
	var jwtOptions = {jwtFromRequest:ExtractJwt.fromAuthHeader(),secretOrKey:process.env.NMICRO_JWT_SECRET};

	var strategy = new JwtStrategy(jwtOptions, function(user, done) {
		if (user) {
			done(null, user);
		} else {
			done(false);
		}
	});

	// errors
	logger.addError('jwtRoleMdw',{code:'UnauthorizedError',message:'Unauthorized invalid role'});
	logger.addError('jwtTokenMdw',{code:'UnauthorizedError',message:'Unauthorized invalid token'});

	passport.use(strategy);

	return function(role){
		return function (req, res, next) {
			passport.authenticate('jwt', { session: false },function(err, _user) {
				redis.user.update(_user,function(user){
					if(user){
						if (role.indexOf(user.role) === -1)
							return next(logger.err_jwtRoleMdw());
						req.user = user;
						return 	next();
					}
					return next(logger.err_jwtTokenMdw());
				});
			})(req, res, next);
		};
	};
};
