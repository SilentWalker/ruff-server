'use strict'
const username = sails.config.username;
const password = sails.config.password;
const mosca = require('mosca');
module.exports = function MqttServer(sails){
  return {
    initialize: function(cb){
      sails.log.info('Mqtt Server Hook Loaded');
      let me = this;
      let mqttServer = function(){

        let ascoltatore = {
          type: 'redis',
          redis: require('redis'),
          db: 12,
          port: 6379,
          return_buffers: true, // to handle binary payloads
          host: "localhost"
        };

        let moscaSettings = {
          port: 2345,
          backend: ascoltatore,
          persistence: {
            factory: mosca.persistence.Redis
          }
        };

        let authenticate = function(client, username, password, callback) {
          let authorized = (username === username && password.toString() === password);
          if (authorized) client.user = username;
          callback(null, authorized);
        }

        let server = new mosca.Server(moscaSettings);
        server.on('ready', setup);

        server.on('clientConnected', function(client) {
          online(client.id);
          sails.log.info('client connected', client.id);
        });

        server.on('clientDisconnected', function(client) {
          offline(client.id);
          sails.log.info('client disconnected', client.id);		
        });

        server.on('published', function(packet, client) {
          //sails.log.info('Published', packet.topic, packet.payload);
          let payload = new Array;
          try{
            payload = packet.payload.toString().split('|');
          }catch(e){
            sails.log.error(e);
          }
          switch(packet.topic){
            default : 
              sails.log.info(`Not Processed Event -> ${packet.topic}`);
          }
        });

        function setup() {
          sails.log.info(`Mosca server is up and running at port ${moscaSettings.port}`);
          server.authenticate = authenticate;
        };

        function online(deviceId){
          sails.log.info(`MQTT : receive ${deviceId} online event`);
        };

        function offline(deviceId){
          sails.log.info(`MQTT : receive ${deviceId} offline event`);
        };

        //msg send to device
        // pubsub.on('msg', (deviceId, payload) => {
        //   let message = {
        //     topic : deviceId,
        //     payload: payload,
        //     qos : 1,
        //     retain : false
        //   };
        //   server.publish(message, function(){
        //     sails.log.info(`topic : ${message.topic}, payload : ${message.payload} published`)
        //   })
        // });
      }
      sails.after(['lifted'], function() {
        mqttServer();
      });
      return cb();
    }
  }
}