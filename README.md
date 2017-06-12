# NMICRO-SERVER v:1.8

## Start neo4j

		$ service neo4j start

## Start Redis

		$ systemctl start redis

## Start test

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
