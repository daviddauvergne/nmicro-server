const path = require('path');
const fs = require('fs-extra');
const cryptPassword = require('./lib/cryptPassword');
const neo4j = require('neo4j-driver').v1;
const parse = require('parse-neo4j').parse;
const Ajv = require('ajv');

var logRed = function(txt){
	console.log('\x1b[31m'+txt+'\x1b[0m');
};

var data = {
	email:     '',
	password:  '',
	firstname: '',
	lastname:  ''
};

var dir = '';

process.argv.forEach(function (val, index, array) {
	switch (index) {
		case 2:
			dir = val;
		break;
		case 3:
			data.email = val;
		break;
		case 4:
			data.password = val;
		break;
		case 5:
			data.firstname = val;
		break;
		case 6:
			data.lastname = val;
		break;
	}
});

var help = `\x1b[34mCreateSuper v0.1\x1b[0m
Usage: node createSuper.js [/path/to/config.env] [email] [password] [firstname] [lastname]
`;

console.log(help);

var configFile = path.join(dir,'config.env');
var configFileSample = path.join(__dirname,'.env.example');

if(!fs.existsSync(configFile)){
	logRed('config.env file does not exist');
} else {
	require('dotenv-safe').load({path:configFile,sample:configFileSample});

	var schema = {
		"type": "object",
		"properties": {
			"email": {
				"description":"User email",
				"format": "email",
				"type": "string"
			},
			"firstname": {
				"description":"User first name",
				"type": "string"
			},
			"lastname": {
				"description":"User last name",
				"type": "string"
			},
			"password": {
				"description":"User password",
				"type": "string",
				"minLength": 6,
				"maxLength": 200
			}
		},
	 "required": ["email","firstname","lastname","password"]
	};

	var ajv = new Ajv({allErrors: true});
	var validate = ajv.compile(schema);

	var valid = validate(data);
	if (!valid) {
		logRed(ajv.errorsText(validate.errors));
	} else {
		// neo4j ------------------------------------------------
		const driver = neo4j.driver(
			process.env.NMICRO_NEO4J_BOLTURL,
			neo4j.auth.basic(process.env.NMICRO_NEO4J_USER, process.env.NMICRO_NEO4J_PASSWORD)
		);
		const session = driver.session();
		data.password = cryptPassword(data.password);
		data.name = (data.firstname+' '+data.lastname).toLowerCase();

			var cypherScript = `CREATE (newsuper:Super {email:$email,password:$password,firstname:$firstname,lastname:$lastname,name:$name})
		RETURN {
		email:newsuper.email
		}`;

		session.run(cypherScript, data).then(function(result){
			var p = parse(result);
			console.log('\x1b[35mSuper: '+p[0].email+' created\x1b[0m');
			session.close();
			driver.close();
		}).catch(function(error) {
			logRed(String(error));
			driver.close();
		});
	}
}
