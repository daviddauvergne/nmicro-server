# NMICRO-SERVER — présentation

## Principe

Simple serveur REST basé sur [restify](http://restify.com/)

## Fonctions

1. serveur REST
1. middleWare:
	1. neo4j
	1. JSON web token
1. validation data via JSON schema
1. session des JSON web token via [Redis](https://redis.io/)
1. mode test:
	1. génération automatique de la documentation
	1. test data entrée/sortie
	1. rechargement automatique des routes lors d'une modification des sources

## Structure d'un projet

- **/path/to/project**
	- **cypher** ➔ dossier pour les ressources "Cypher" ex: cypher/user/login.cyp
	- **jschema** ➔ dossier pour les ressources JSON schema
		- **req** ➔ dossier pour les requêtes
		- **res** ➔ dossier pour les réponses
			- **error.json** ➔ fichier JSON schema pour les erreurs ex : {code:'BadRequestError',message:'User does not exist'}
			- **ok.json** ➔ fichierJSON schema pour une réponse valide simple : {message:'ok'}
	- **routes** ➔ dossier pour les routes ex: routes/user/login.js
- **config.env** ➔ fichier de configuration pour nmicro-server

## Route example

```js

module.exports = function(tool){
	/*
	tool : NMICRO_SERVER tools
	 - logger (logging)
	 - session (Simply user session)
	 - middleWare :
		 - cypherMdw (Cypher middleWare)
	};
	*/
	return {
		// Route method get, post, put, del (required)
		method : 'post',

		// Route name (required)
		name : 'foobar',

		// version route
		// version: '2.0.0' or ['2.0.0', '2.1.0', '2.2.0']

		// Route path (required)
		path : '/foo/bar',

		// List of authorized roles (optional)
		role : ['User'],

		// Validation in/out with JSON schema
		schema : {
			// request JSON schema
			req : 'req/foo/bar', // path : jschema/req/foo/bar.json
			// response JSON schema (test mode only!)
			// Key => HTTP code
			res : {
				200 : 'res/ok', // path : jschema/res/ok.json
				401 : 'res/error' // path : jschema/res/error.json
			}
		},

		// Routes errors
		// Key => HTTP code
		// value  => object
		//          code => type string, Restify error code: http://restify.com/#error-handling
		//          message type string
		errors : {
			401 : {code:'UnauthorizedError',message:'Invalid email or password'}
		},

		// handler
		handler : [

			/**
				* Cypher middleWare
				* Run session neo4j
				* @param {string} cypherPath (required)
				* @param {array} associateKeys (optional)
				* @return {mixed} result request neo4j

				ex:
				tool.cypherMdw('foo/bar') => req.cypher

				tool.cypherMdw('foo/bar',['bar']) => req.cypher.bar

			*/
			tool.cypherMdw('foo/bar',['bar']),

			function (req, res, next) {

				console.log(req.cypher.bar);

				// emmit Error
				// return next(tool.logger.err_foobar401());


				/** session

					tool.session.set(user)
					@param user {object}

					tool.session.update(user,callback)
					@param user {object}
					@param calbach {object}

					tool.session.del(user)
					@param user {object}

					Quand rôle n'est pas undefined
					alors les information de l'utilisateur sont accessibles ainsi: req.user

				*/

				res.send({message:'ok'});
				return next();
			}
		]
	};
};
```
