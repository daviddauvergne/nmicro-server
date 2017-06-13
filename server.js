const os = require('os');
const restify = require('restify');
const fs = require('fs-extra');
const path = require('path');
const neo4j = require('neo4j-driver').v1;
const parse = require('parse-neo4j').parse;
const logger = require('./lib/logger');
const reload = require('require-reload')(require);

// args -------------------------------------------------------------------------------
var TESTMODE = false;
var TMROUTES = {};
const argv = require('yargs')
	.usage('Usage: $0 /path/to/directory [options]')
	.example(`# Test mode
		$0 /path/to/directory -t

		# Production mode
		$0 /path/to/directory
		`)
	.demandCommand( 1, '\x1b[31mDIR is required\n\x1b[0m')
	.strict()

	.alias('t', 'test')
	.describe('t', 'Test mode')
	.default('t',false)

	.check(function (argv) {
		var dir = path.join(path.resolve(argv._[0]));
		if (fs.existsSync(dir)) {
			return true;
		} else {
			throw(new Error("\x1b[31mInvalid DIR, path: "+dir+" does not exist\n\x1b[0m",false,true));
		}
	})

	.alias('h', 'help')
	.help('help')
	.locale('en')
	.argv;

// struture folder ---------------------------------------------------------------------
var dir = path.resolve(argv._[0]);
fs.ensureDirSync(path.join(dir,'cypher'));
fs.ensureDirSync(path.join(dir,'jschema','req'));
fs.ensureDirSync(path.join(dir,'jschema','res'));
fs.ensureDirSync(path.join(dir,'routes'));

// configuration -----------------------------------------------------------------------
var configFile = path.join(dir,'config.env');
var configFileSample = path.join(__dirname,'.env.example');
if(!fs.existsSync(configFile)){
	// create configuration
	fs.copySync(configFileSample, configFile);
	fs.copySync(path.join(__dirname,'data','ok.json'),path.join(dir,'jschema','res','ok.json'));
	fs.copySync(path.join(__dirname,'data','error.json'),path.join(dir,'jschema','res','error.json'));
	const pjson = require('./package.json');
	logger.msg([{b_blue: pjson.name}],true);
	logger.msg([{green:  'Version: '+pjson.version}]);
	logger.msg([{yellow: 'The folder structure was created'}]);
	logger.msg([{yellow: 'Update the configuration file: config.env'}]);
	process.exit(1);
} else {
	// load configuration
	require('dotenv-safe').load({path:configFile,sample:configFileSample});
}
// path project
process.env.NMICRO_SERVER_DIR = dir;

// error statk
Error.stackTraceLimit = 2;

logger.msg([{b_blue:process.env.NMICRO_SERVER_NAME}],true);
logger.msg([{green:'Version: '+process.env.NMICRO_SERVER_VERSION}]);

if(argv.test){
	TESTMODE = true;
	process.env.TESTMODE = TESTMODE.toString();
	logger.msg([{yellow:'Mode TEST'}]);
} else {
	logger.msg([{red:'Mode Prod'}]);
}
// logger initiolisation transport by mode
logger.init();

// documentation
const mdWriter = require('./lib/mdWriter');
var documentationDir = path.join(process.env.NMICRO_SERVER_DIR,'documentation');

// redis -------------------------------------------------------------------------------
const redis = require("redis");
const client = redis.createClient();
const rediser = require("./lib/rediser")(client);

// neo4j -------------------------------------------------------------------------------
const driver = neo4j.driver(
	process.env.NMICRO_NEO4J_BOLTURL,
	neo4j.auth.basic(process.env.NMICRO_NEO4J_USER, process.env.NMICRO_NEO4J_PASSWORD)
);
const sessionNeo4j = driver.session();

// restify -----------------------------------------------------------------------------
var retifyOpts = {
	name: process.env.NMICRO_SERVER_NAME,
};
if(process.env.NMICRO_SERVER_CERTIFICATE_PATH!='null'){
	if(fs.existsSync(process.env.NMICRO_SERVER_CERTIFICATE_PATH))
		retifyOpts.certificate = fs.readFileSync(process.env.NMICRO_SERVER_CERTIFICATE_PATH);
	else
		logger.msg([{red:'Invalid NMICRO_SERVER_CERTIFICATE_PATH !'}]);

	if(fs.existsSync(process.env.NMICRO_SERVER_KEY_PATH))
		retifyOpts.key = fs.readFileSync(process.env.NMICRO_SERVER_KEY_PATH);
	else
		logger.msg([{red:'Invalid NMICRO_SERVER_KEY_PATH !'}]);
}
const server = restify.createServer();

server.use(restify.bodyParser({
	maxBodySize: 0,
	uploadDir: os.tmpdir(),
	multiples: true,
	mapParams: true,
		mapFiles: true,
}));

var corsOrigin = process.env.NMICRO_CORS_ORIGIN.trim().split(',').map(function(s) { return s.trim(); });
restify.CORS.ALLOW_HEADERS.push('authorization');
server.use(restify.CORS({
	credentials: true,
	origins:corsOrigin
}));

// JWT middleWare ----------------------------------------------------------------------
const jwtMdw = require('./middleware/jwt')(logger,rediser);

// rounting loader ---------------------------------------------------------------------

// Tools for Handler
var tools = {
	// logger -------------------------------------------------------
	logger : logger,
	// session ------------------------------------------------------
	session : rediser,
	// Crypt password -----------------------------------------------
	cryptPassword : require('./lib/cryptPassword')
};

// validation middleware ----------------------------------------
var validatMdw = require('./middleware/validating');

// JSON schema loader
var loadSchema = function(name){
	try {
		var schema = JSON.parse(require('fs').readFileSync(path.join(process.env.NMICRO_SERVER_DIR,'jschema',name+'.json'), 'utf8'));
		return schema;
	} catch (e) {
		logger.msg([{red:'Error load schema: '+name}]);
		process.exit(1);
	}
};

var getFiles = function(_path, files){
	fs.readdirSync(_path).forEach(function(file){
		var subpath = path.join(_path,file);
		if(fs.lstatSync(subpath).isDirectory()){
			getFiles(subpath, files);
		} else {
			var f = path.join(_path,file);
			files.push(f);
		}
	});
};

var routesFiles = [];
var routeAndHandlers = {};

var errorSchema = loadSchema('res/error');

var loadRoutes = function(){

	// cypher middleWare
	tools.cypherMdw = reload('./middleware/cypher')(logger,sessionNeo4j);

	// remove route if exist
	for (var _routeName in routeAndHandlers) {
		if(server.routes[_routeName])
			server.rm(_routeName);
	}

	// Routes
	routesFiles = [];

	routeAndHandlers = {};

	getFiles(path.join(process.env.NMICRO_SERVER_DIR,'routes'), routesFiles);

	// Register routes
	routesFiles.forEach(function(file){

		try {
			var route = reload(file)(tools);
			var routeName = route.name.replace(/\W/g, '').toLowerCase();

			// definition
			var def = {name: route.name, path: route.path};
			// version
			if(route.version)
				def.version = route.version;

			routeAndHandlers[routeName] = [def];

			// errors
			if(route.errors){
				for (var code in route.errors) {
					logger.addError(route.name+code,route.errors[code]);
				}
			}
			// role
			if(route.role){
				routeAndHandlers[routeName].push(jwtMdw(route.role));
			}
			// schema
			if(route.schema && route.schema.req){
				routeAndHandlers[routeName].push(validatMdw(logger,loadSchema(route.schema.req)));
			}
			if(TESTMODE){

				TMROUTES[routeName] = {
					method: route.method,
					path : route.path,
					res: {}
				};
				if(route.description)
					TMROUTES[routeName].description = route.description;

				if(route.schema){
					if(route.schema.res){
						for (var coderes in route.schema.res) {
							TMROUTES[routeName].res[coderes] = loadSchema(route.schema.res[coderes]);
						}
					}
					if(route.schema.req)
						TMROUTES[routeName].req = loadSchema(route.schema.req);
				}
			}
			// handler
			route.handler.forEach(function(h){
				routeAndHandlers[routeName].push(h);
			});

			server[route.method].apply(server,routeAndHandlers[routeName]);
		} catch (err) {
			logger.error(err);
		}
	});
	if(TESTMODE){
		// documentation
		fs.ensureDir(documentationDir,function(err){
			if(err) throw err;
			mdWriter(path.join(documentationDir,'API.md'),TMROUTES);
		});
	}
};

// Test connexion REDIS ---------------------------------------------------------------
client.on('connect', function() {
	logger.msg([{b_black:'Redis instance successfully connected.'}]);

	// Test connexion Neo4j -------------------------------------------------------------
	sessionNeo4j.run('RETURN "Neo4j instance successfully connected."').then(function(result){
		logger.msg([{b_black:parse(result)[0]}]);
		sessionNeo4j.close();

		// TESTMODE -----------------------------------------------------------------------
		if(TESTMODE){

			// Start request
			server.pre(function(req, res, next) {
				logger.info(req.url+' - METHOD: '+req.method);
				return next();
			});

			// No found event
			server.on('NotFound',function(req,res,error,next){
				logger.warn(error.message);
				res.header("Access-Control-Allow-Origin", "*");
				res.header("Access-Control-Allow-Headers", "X-Requested-With");
				res.setHeader("Access-Control-Allow-Methods", "POST, GET");
				res.setHeader("Access-Control-Allow-Headers", "Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
				if(req.method === "OPTIONS"){
					res.send(200);
				} else {
					res.send(404,{code:"NotFoundError",message:'Page was not found'});
					logger.line();
				}
				next();
			});

			// Test data final request
			const Ajv = require('ajv');
			server.on('after',function(req,res,route,error){
				if(route && route.spec){
					if(error){
						logger.info(route.spec.path+' - HTTP code: '+error.statusCode);
						var existSchema = false;
						var schema = errorSchema;
						if(TMROUTES[route.spec.name].res[error.statusCode]){
							existSchema = true;
							schema = TMROUTES[route.spec.name].res[error.statusCode];
						}

						var ajv = new Ajv({allErrors: true});
						var valid = ajv.validate(schema,error.body);
						if (!valid) {
							logger.error(
								'response schema does not conform [code: '+error.statusCode+']\n'+
								ajv.errorsText(valid.errors,{separator: "\n"})
							);
						} else {
							var defaultSchema = '"';
							if(!existSchema)
								defaultSchema = ' [warn: default schema error]"'
							logger.info('"━━━ OK ━━━'+defaultSchema);
						}
						if(!existSchema)
							logger.warn('response schema does not exist [code: '+error.statusCode+']');
					} else {
						logger.info(route.spec.path+' - HTTP code: 200');
						if(TMROUTES[route.spec.name].res['200']){
							var schema200 = TMROUTES[route.spec.name].res['200'];
							var ajv200 = new Ajv({allErrors: true});
							var valid200 = ajv200.validate(schema200,res._body);
							if (!valid200) {
								logger.error(
									'response schema does not conform [code: 200]\n'+
									ajv200.errorsText(valid200.errors,{separator: "\n"})
								);
							} else {
								logger.info('"━━━ OK ━━━"');
							}
						} else {
							logger.error('response schema does not exist [code: 200]');
						}
					}
					logger.line();
				}
			});

			const watchr = require('watchr');
			var stalker = watchr.open(process.env.NMICRO_SERVER_DIR,
				function(changeType, fullPath, currentStat, previousStat) {
					var shortPath = fullPath.substring(process.env.NMICRO_SERVER_DIR.length+1);
					var pathArr = shortPath.split('/');
					if(pathArr[0]!='log' && pathArr[0]!='documentation'){
						logger.msg([{blue:'File change: '},{cyan:shortPath}]);
						loadRoutes();
					}
				},
				function (err) {
					if ( err )  return console.log('watch failed on', path, 'with error', err);
					logger.msg([{blue:'watch successful on'}]);
				}
			);
			stalker.setConfig({catchupDelay: 300});
		}

		loadRoutes();

		// Start server ------------------------------------------------------------------------
		server.listen(process.env.NMICRO_SERVER_PORT, process.env.NMICRO_SERVER_IP, function() {
			logger.msg([{b_black:server.name+' listening at '+server.url}]);
		});

	}).catch(function(error) {
		logger.msg([{red:'Error connecting to the Neo4j instance'}]);
		console.log(error);
		process.exit(1);
	});

});
client.on("error", function (error) {
	logger.msg([{red:'Error connecting to the Redis instance'}]);
	console.log(error);
	process.exit(1);
});
