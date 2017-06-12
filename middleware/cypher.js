// Cypher middleWare
const fs = require('fs');
const path = require('path');
const parse = require('parse-neo4j').parse;
var cypherQuery = {};

var walkSync = function(dir, filelist) {
	files = fs.readdirSync(dir);
	filelist = filelist || [];
	files.forEach(function(file) {
		if (fs.statSync(path.join(dir, file)).isDirectory()) {
			filelist = walkSync(path.join(dir, file), filelist);
		} else {
			filelist.push(path.join(dir, file));
		}
	});
	return filelist;
};

module.exports = function(logger,sessionNeo4j) {
	var cypherDir = path.join(process.env.NMICRO_SERVER_DIR,'cypher');
	var files = walkSync(cypherDir);

	files.forEach(function(file){
		var r = path.relative(cypherDir,file).split('.')[0];
		cypherQuery[r] = fs.readFileSync(file, 'utf8');
	});

	// errors
	logger.addError('cypherInvalidMdw',{code:'InternalServerError',message:'Internal server error'});
	logger.addError('cypherNotExitMdw',{code:'InternalServerError',message:'Internal server error'});

	return function(cypherQueryName,keys,params){
		return function (req, res, next) {

			if(cypherQuery[cypherQueryName]){
				var _params;
				if(params!==undefined)
					_params = params;
				else
					_params = req.params;
				if(!req.cypher)
					req.cypher = [];

				for (var p in _params) {
					if(_params[p].constructor.name=='Buffer')
						delete _params[p];
				}
				sessionNeo4j.run(cypherQuery[cypherQueryName], _params).then(function(result){

					var p = parse(result);
					var r = {};
					if(keys!=undefined){
						keys.forEach(function(key,idx){
							r[key] = p[idx];
						});
					} else {
						r = p;
					}

					req.cypher = r;
					sessionNeo4j.close();
					return next();
				}).catch(function(error) {
					var errorCode = JSON.parse(JSON.stringify(error)).code;
					var errorString = String(error);
					sessionNeo4j.close();
					if(errorCode=='Neo.ClientError.Schema.ConstraintValidationFailed'){
						req.cypher = 'ConstraintValidationFailed';
						return next();
					}
					return next(logger.err_cypherInvalidMdw(null,`[${cypherQueryName}] cypher: ${errorString} code: ${errorCode}`));
				});
			} else {
				return next(logger.err_cypherNotExitMdw(null,`cypher: '${cypherQueryName}' does not exist`));
			}
		};
	};
};
