const json2md = require("json2md");
const mdTable = require('markdown-table');
const fs = require('fs-extra');

module.exports = function(file,routes){
	var md = [];

	var title = function(val){
		md.push({ h3: val });
	};

	var para = function(val){
		md.push({ p: val });
	};

	md.push({ h1: process.env.NMICRO_SERVER_NAME + ' API v: '+ process.env.NMICRO_SERVER_VERSION });

	para(process.env.NMICRO_SERVER_DESCRIPTION);

	var json = function(val,title){

		if(val.items){
			var nextTable = [];
			if(title)
				para('Items: **'+title+'**');
			else
				para('Items:');
			var table = [['Type','Description']];
			var desc = [val.items.type];
			var _typeL = val.items.type.toLowerCase();
			if(_typeL=='object' || _typeL=='array'){
				nextTable.push({name:title,data:val.items});
			}
			if(val.items.description)
				desc.push(val.items.description);

			table.push(desc);

			para(mdTable(table));
			nextTable.forEach(function(nt){
				json(nt.data,nt.name);
			});
		} else {

			var required = [];
			var p = {};
			var paramsAdd = [];
			var nextTable = [];
			var paramsTitle = ['Property','Type','Description','Required'];
			if(val.required)
				required = val.required;

				var props = val.properties;

				for (var name in props) {
					p[name] = {
						'Property': '**'+name+'**'
					};
					var _type = props[name].type;
					if(_type){
						var _typeL = _type.toLowerCase();
						if(_typeL=='object' || _typeL=='array'){
							nextTable.push({name:name,data:props[name]});
						}
						p[name].Type = _type;
					}

					if(props[name].description)
						p[name].Description = props[name].description;
					else
						p[name].Description = '';

					if(required.indexOf(name)===-1){
						p[name].Required = 'No';
					} else {
						p[name].Required = 'Yes';
					}

					var keys = Object.keys(props[name]);
					keys.forEach(function(k){
						if(k!='type' && k!='description' && k!='properties' && k!='required' && k!='items'){
							if(paramsAdd.indexOf(k)===-1)
								paramsAdd.push(k);
						}
					});
				}

				for (var n in props) {
					paramsAdd.forEach(function(_param){
						if(props[n][_param]){
							p[n][[_param]] = props[n][_param];
						} else {
							p[n][[_param]] = '';
						}
					});
				}

				var head = paramsTitle.concat(paramsAdd);
				var table = [head];

				for (var paraName in p) {
					table.push(Object.values(p[paraName]));
				}


			if(title){
				para('Property: **'+title+'**');
			}
			para(mdTable(table));
			nextTable.forEach(function(nt){
				json(nt.data,nt.name);
			});

			if(!title){
				para('*JSON schema*');
				md.push({code:{ language: "json", content: JSON.stringify(val,null,' ') }});
			}
		}
	};

	for (var rn in routes) {
		var r = routes[rn];
		// title (path)
		if(r.description){
			md.push({ h2: r.path });
			para(r.description);
		} else {
			md.push({ h2: r.path+"\n" });
		}

		// method
		title('Method');
		para(r.method.toUpperCase());

		title('Params');
		if(r.req){
			json(r.req);
		} else {
			para('None');
		}

		if(r.res['200']){
			title('Success Response');
			para('**Code: 200**');
			json(r.res['200']);
		}

		var errorTitle = true;
		var errorCount = 0;
		for (var code in r.res) {
			if (code!='200') {
				if(errorTitle){
					title('Error Response');
					errorTitle = false;
				}
				if(errorCount>0)
					para('OR');
				para('**Code: '+code+'**');

				json(r.res[code]);
				errorCount++;
			}
		}
	}
	mdString = json2md(md).replace(/\|\n\n\|/gm,'|\n|');
	fs.writeFile(file, mdString, function(err){
		if (err) throw err;
	});
};
