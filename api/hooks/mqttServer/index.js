'use strict'
const mosca = require('mosca');
const moment = require('moment');
moment.locale('zh-cn');
module.exports = function MqttServer(sails) {
  return {
    initialize: function (cb) {
      const pubsub = sails.config.pubsub;
      sails.log.info('Mqtt Server Hook Loaded');
      const _username = sails.config.username;
      const _password = sails.config.password;
      let me = this;
      let mqttServer = function () {

        let ascoltatore = {
          type: 'redis',
          redis: require('redis'),
          db: 11,
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

        let authenticate = function (client, username, password, callback) {
          let authorized = (username === _username && password.toString() === _password);
          if (authorized) client.user = username;
          callback(null, authorized);
        }

        let server = new mosca.Server(moscaSettings);
        server.on('ready', setup);

        server.on('clientConnected', function (client) {
          online(client.id);
          sails.log.info('client connected', client.id);
        });

        server.on('clientDisconnected', function (client) {
          offline(client.id);
          sails.log.info('client disconnected', client.id);
        });

        server.on('published', function (packet, client) {
          //sails.log.info('Published', packet.topic, packet.payload);
          let payload = packet.payload;
          switch (packet.topic) {
            case 'temp':
              sails.log.debug(`receive temp message , current temp is ${payload}`)
              sails.services.redis.hset(client.id, 'temp', payload, (err, rs) => {
                if (err) sails.log.error(err);
              })
            break;
            case 'humi':
              sails.log.debug(`receive humi message , current humi is ${payload}`)
              sails.services.redis.hset(client.id, 'humi', payload, (err, rs) => {
                if (err) sails.log.error(err);
              })
            break;
            case 'sound':
              sails.log.debug(`receive sound message`);
              if(!me.lighted){
                me.lighted = true;
                let currentTime = moment(new Date()).format('HH:mm:ss');
                let timeArr = currentTime.split(':');
                if(Number(timeArr[0]) >= 0 && Number(timeArr[0] <= 6)){
                  sails.log.debug('light up led');
                  pubsub.emit('msg', client.id, 'lightUp');
                  setTimeout(() => {
                    me.lighted = false;
                  }, 21020);
                }
              }
            break;
            default:
              sails.log.info(`Not Processed Event -> ${packet.topic}`);
          }
        });

        function setup() {
          sails.log.info(`Mosca server is up and running at port ${moscaSettings.port}`);
          server.authenticate = authenticate;
        };

        function online(deviceId) {
          sails.log.info(`MQTT : receive ${deviceId} online event`);
        };

        function offline(deviceId) {
          sails.log.info(`MQTT : receive ${deviceId} offline event`);
        };

        // msg send to device
        pubsub.on('msg', (deviceId, payload) => {
          let message = {
            topic: deviceId,
            payload: payload,
            qos: 2,
            retain: false
          };
          server.publish(message, function () {
            sails.log.info(`topic : ${message.topic}, payload : ${message.payload} published`)
          })
        });
      }
      sails.after(['lifted'], function () {
        mqttServer();
      });
      return cb();
    }
  }
}