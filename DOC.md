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
