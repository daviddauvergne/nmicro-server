# NMICRO-SERVER v:1.0.8

## Install

		$ cd /path/to/nmicro-server/
		$ npm install

## Help

		$ node server.js --help

## Start test

If this is the first micro-server startup, this one will first create the folder structure and ask you to update the config file

		$ node server.js /path/to/project --test

OR

		$ node server.js /path/to/project -t

## Start with pm2


### Mode prod

		$ pm2 start server.js --name nmicro-server-name -- /path/to/project

Restart

		$ pm2 restart nmicro-server-name

4 clusters

		$ pm2 start server.js --name nmicro-server-name -i 4 -- /path/to/project
