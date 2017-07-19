var redis = require('redis')
var client = redis.createClient('6379', 'localhost');

client.select(4, function(err, data){
  if(err){
    sails.log.error('Redis Select DB Failed');
    sails.log.error(err);
  }else{
    sails.log.info('Redis client Start Success');
  }
});

module.exports = client;