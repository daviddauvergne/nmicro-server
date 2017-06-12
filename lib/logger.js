
const winston = require('winston');
const restify = require('restify');
const fs = require('fs-extra');
const path = require('path');
const vsprintf = require('sprintf-js').vsprintf;
winston.emitErrs = true;


var formatter = function(args){
	if(args.message=='─────────────────────────────────────────────────────────')
		return '─────────────────────────────────────────────────────────';
	var date = new Date().toLocaleDateString(undefined,{
		day : 'numeric',
		month : 'numeric',
		year : 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});
	var msg = '';
	if(Object.keys(args.meta).length !== 0){
		msg += '\n'+JSON.stringify(args.meta,null,'\t')
	}
	return date+' - '+args.level.toUpperCase()+' - '+args.message.trim()+msg;
};


var chars = {

space : ['   ',
				 '   ',
				 '   '],

tiret : ['  ',
				 '─ ',
				 '  '],

a : ['┌─┐ ',
		 '├─┤ ',
		 '┴ ┴ '],

b : ['┌┐  ',
		 '├┴┐ ',
		 '└─┘ '],

c : ['┌─┐ ',
		 '│   ',
		 '└─┘ '],

d : ['┌┬┐ ',
		 ' ││ ',
		 '─┴┘ '],

e : ['┌─┐ ',
		 '├┤  ',
		 '└─┘ '],

f : ['┌─┐ ',
		 '├┤  ',
		 '└   '],

g : ['┌─┐ ',
		 '│ ┬ ',
		 '└─┘ '],

h : ['┬ ┬ ',
		 '├─┤ ',
		 '┴ ┴ '],

i : ['┬ ',
		 '│ ',
		 '┴ '],

j : [' ┬ ',
		 ' │ ',
		 '└┘ '],

k : ['┬┌─ ',
		 '├┴┐ ',
		 '┴ ┴ '],

l : ['┬   ',
		 '│   ',
		 '┴─┘ '],

m : ['┌┬┐ ',
		 '│││ ',
		 '┴ ┴ '],

n : ['┌┐┌ ',
		 '│││ ',
		 '┘└┘ '],

o : ['┌─┐ ',
		 '│ │ ',
		 '└─┘ '],

p : ['┌─┐ ',
		 '├─┘ ',
		 '┴   '],

q : ['┌─┐  ',
		 '│─┼┐ ',
		 '└─┘└ '],

r : ['┌┬─┐ ',
		 ' ├┬┘ ',
		 ' ┴└─ '],

s : ['┌─┐ ',
		 '└─┐ ',
		 '└─┘ '],

t : ['┌┬┐ ',
		 ' │  ',
		 ' ┴  '],

u : ['┬ ┬ ',
		 '│ │ ',
		 '└─┘ '],

v : ['┬  ┬ ',
		 '└┐┌┘ ',
		 ' └┘  '],

w : ['┬ ┬ ',
		 '│││ ',
		 '└┴┘ '],

x : ['─┐ ┬ ',
		 '┌┴┬┘ ',
		 '┴ └─ '],

y : ['┬ ┬ ',
		 '└┬┘ ',
		 ' ┴  '],

z : ['┌─┐ ',
		 '┌─┘ ',
		 '└─┘ ']
};

var fgColors = {
	b_ : "\x1b[1m",
	d_ : "\x1b[2m",
	black : "\x1b[30m",
	red : "\x1b[31m",
	green : "\x1b[32m",
	yellow : "\x1b[33m",
	blue : "\x1b[34m",
	magenta : "\x1b[35m",
	cyan : "\x1b[36m",
	white : "\x1b[37m"
};

var toTitle = function(text){
	text = text.toLowerCase().split('');
	var line1 = [];
	var line2 = [];
	var line3 = [];

	text.forEach(function(c){
		switch (c) {
			case ' ': c = 'space';break;
			case '-': c = 'tiret';break;
		}
		if(chars[c]){
			line1.push(chars[c][0]);
			line2.push(chars[c][1]);
			line3.push(chars[c][2]);
		}
	});
	return line1.join('')+'\n'+line2.join('')+'\n'+line3.join('');
};

var getColor = function(key){
	var prefix = key.substring(0, 2);
	if(prefix=='b_' || prefix=='d_'){
		var color = key.substring(2, key.length);
		return fgColors[prefix]+fgColors[color];
	}
	return fgColors[key];
};

var lg = function(type,args){
	if(process.env.TESTMODE=='true')
		args.unshift('S-'+process.env.NMICRO_SERVER_PORT);
	args.unshift(type);
	logger.log.apply(logger, args);
};

var logger = console;

module.exports = {

	init : function(){
		fs.ensureDir(process.env.NMICRO_LOG_DIRECTORY,function(err){
			if(err)
				throw err;
		});

		if(process.env.TESTMODE=='true'){
			fs.ensureFileSync(process.env.NMICRO_LOG_DIRECTORY+'/test.log');
			logger = new winston.Logger({
				transports: [
					new winston.transports.Console({
						level: 'debug',
						prettyPrint: true,
						handleExceptions: true,
						json: false,
						colorize: true
					}),
					new winston.transports.File({
						name: 'error-file',
						level: 'debug',
						filename: process.env.NMICRO_LOG_DIRECTORY+'/test.log',
						handleExceptions: true,
						json: false,
						maxsize: 1000000, //1MB
						maxFiles: 5,
						colorize: false,
						formatter : formatter
					})
				],
				exitOnError: false
			});
		} else {
			logger = new winston.Logger({
					levels :  {
						info :0,
						error : 1
					},
					transports: [
							new winston.transports.File({
								name: 'info-file',
								level: 'info',
								filename: process.env.NMICRO_LOG_DIRECTORY+'/info.log',
								handleExceptions: false,
								json: false,
								maxsize: 5242880, //5MB
								maxFiles: 5,
								colorize: false
							}),
							new winston.transports.File({
								name: 'error-file',
								level: 'error',
								filename: process.env.NMICRO_LOG_DIRECTORY+'/error.log',
								handleExceptions: true,
								json: false,
								maxsize: 5242880, //5MB
								maxFiles: 5,
								colorize: false,
								formatter : formatter
							})
					],
					exitOnError: false
			});
		}
	},

	addError : function(name,err){
		this['err_'+name] = function(data,error){
			var msg = (err.message);
			if(data)
				msg = vsprintf(err.message, data);
			if(error)
				logger.log('error', error);
			return new restify[err.code](msg);
		}
	},
	error : function(message){
		lg('error', [message]);
	},
	debug : function(message){
		lg('debug', [message]);
	},
	info : function(message){
		lg('info', [message]);
	},
	line : function(){
		logger.info('─────────────────────────────────────────────────────────');
	},
	msg : function(logs,title){
		var str = '';
		logs.forEach(function(log){
			var key = Object.keys(log)[0];
			var color = getColor(key);
			var txt = log[key];
			if(title)
				txt = toTitle(txt);
			str += color+txt+'\x1b[0m';
		});
		console.log(str);
	}
};
