
const NMICRO_REDIS_SESSION_TIME = parseInt(process.env.NMICRO_REDIS_SESSION_TIME);

var idu = function(id){
	return 'user-'+id;
};

module.exports = function(client){
	return {
		user : {
			set : function(user){
				client.set(idu(user.id), user.iat, 'EX',NMICRO_REDIS_SESSION_TIME);
			},
			update : function(user,callback){
				if(user){
					var id = idu(user.id);
					client.get(id, function(err, reply) {
						if(reply){
							client.set(id, user.iat, 'EX',NMICRO_REDIS_SESSION_TIME);
							callback(user);
						} else {
							callback(null);
						}
					});
				} else {
					callback(null);
				}
			},
			del : function(user){
				client.del(idu(user.id));
			}
		}
	};
};
