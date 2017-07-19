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
            case 'battery' : //电池状态
              sails.log.info(`battery : ${payload}`);
              if(payload.length === 3){
                Device.update({deviceId: payload[0]}, {isPlugged: payload[1], batteryLevel: payload[2]}).exec((err, rs) => {
                  if(err) sails.log.error(`MQTT : update device battery status failed,   ${err}`);
                })
              };
              break;
            
            case 'bluetoothaddressconfirm' : //蓝牙地址确认
              sails.log.info(`bluetoothaddressconfirm : ${payload}`);
              if(payload.length === 2){
                Device.update({deviceId: payload[0]}, {blueToothAddress : payload[1]}).exec((err, rs) => {
                  if(err) sails.log.error(`MQTT : update device bluetoothaddress failed,   ${err}`);
                })
              };
              break;

            case 'reportgeo' : //上报地理位置
              sails.log.info(`reportgeo : ${payload}`);
              if(payload.length === 3){
                Device.update({deviceId: payload[0]}, {lat : payload[1], lon : payload[2]}).exec((err, rs) => {
                  if(err) sails.log.error(`MQTT : update device geo failed,   ${err}`);
                })
              };
              break;
            
            case 'passwordconfirm' : //退出密码确认
              sails.log.info(`passwordconfirm : ${payload}`);
              if(payload.length === 2){
                 Device.update({deviceId: payload[0]}, {password : payload[1]}).exec((err, rs) => {
                  if(err) sails.log.error(`MQTT : update device password failed,   ${err}`);
                })               
              }
              break;
            
            case 'durationconfirm' : //设置持续时间确认
              sails.log.info(`durationconfirm : ${payload}`);
              if(payload.length === 2){
                Device.update({deviceId: payload[0]}, {duration : payload[1]}).exec((err, rs) => {
                  if(err) sails.log.error(`MQTT : update device duration failed,   ${err}`);
                })                
              }
              break;
            
            case 'version' : //版本信息
              sails.log.info(`version : ${payload}`);
              if(payload.length === 2){
                Device.update({deviceId: payload[0]}, {version : payload[1]}).exec((err, rs) => {
                  if(err) sails.log.error(`MQTT : update device version failed,   ${err}`);
                })                
              }
              break;

            case 'connectionConfirm' : //连接确认
              sails.log.info(`connectionConfirm : ${payload}`);
              if(payload.length === 2){
                Device.update({deviceId: payload[0]}, {status : 'free'}).exec((err, rs) => {
                  if(err) sails.log.error(`MQTT : update device connectionConfirm failed,   ${err}`);
                }) 
              }
              break;

            case 'mqttUrlConfirm' : //MqttUrl确认
              sails.log.info(`mqttUrlConfirm : ${payload}`);
              if(payload.length === 2){
                Device.update({deviceId: payload[0]}, {mqttUrl : payload[1]}).exec((err, rs) => {
                  if(err) sails.log.error(`MQTT : update device mqttUrlConfirm failed,   ${err}`);
                }) 
              }
              break;

            case 'coin' : //投币
              sails.log.info(`coin : ${payload}`);
              if(payload.length === 1){
                sails.services.device.coinEvent(payload[0], (err) => {
                  if(err) sails.log.error(`MQTT : coin event error, ${err}`);
                })
              }
              break;

            case 'run' : //设备启动反馈
              sails.log.info(`run : ${payload}`);
              if(payload.length === 1){
                sails.services.device.run(payload[0], (err) => {
                  if(err) sails.log.error(`MQTT : run event error, ${err}`);
                })
              }
              break;
            
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
          Device.findOne({deviceId: deviceId}).exec((err, device) => {
            if(!err && device){
              if(device.status === 'offline'){
                Device.update({deviceId : deviceId}, {status : 'free', isActive: true}).exec((err, rs) => {
                  if(!err) sails.log.info(`MQTT : update ${deviceId} set status online`);
                  sails.services.logger.onlineEventLog(deviceId);
                })
                Redis.getAsync(deviceId).then((id) => {
                  if(id && id !== 'null'){
                    sails.log.info(`new online event received, but previous online event not end`);
                  }else{
                    sails.log.info(`new online event received, start recording online time`);
                    OnlineTime.create({
                      deviceId : deviceId,
                      start : new Date()
                    }).exec((err, ot) => {
                      if(!err && ot){
                        Redis.set(deviceId, ot.id, (err, rs) => {
                          if(err){
                            sails.log.error(err)
                          }else{
                            sails.log.info(`new online time record created at ${ot.id}`);
                          }
                        })
                      }
                    })
                  }
                }).catch((err) => {
                  sails.log.error(err);
                })
              }
            }
          })
        };

        function offline(deviceId){
          sails.log.info(`MQTT : receive ${deviceId} offline event`);
          Device.findOne({deviceId : deviceId}).exec((err, device) => {
            if(!err && device){
              if(device.status === 'free' || device.status === 'busy'){
                Device.update({deviceId: deviceId}, {status: 'offline', isActive: false}).exec((err, rs) => {
                  if(!err) sails.log.info(`MQTT : update ${deviceId} set status offline`);
                  sails.services.logger.alarmLog('ALARM', 'disconnect', deviceId, '0', '0', '0');
                })
                Redis.getAsync(deviceId).then((id) => {
                  if(id && id !== 'null'){
                    sails.log.info(`new offline event received, online time record existed at ${id}`);
                    OnlineTime.findOne({id : id}).exec((err, ot) => {
                      Redis.set(deviceId, 'null', (err, rs) => {
                        if(err){ 
                          sails.log.error(err)
                        }else{
                          sails.log.info(`reset ${deviceId} online time event id`)
                        }
                      })
                      if(!err && ot){
                        let end = new Date();
                        let duration = Math.round((new Date(end).getTime() - new Date(ot.start).getTime()) / 1000);
                        OnlineTime.update({id : id}, {end : end, duration : duration}).exec((err, rs) => {
                          if(!err && rs){
                            sails.log.info(`online time record complete, ${deviceId}'s duration is ${duration} s`);
                          }else if(err){
                            sails.log.error(err);
                          }
                        })
                      }
                    })
                  }else{
                    sails.log.info(`new offline event received, but no previous online record found`);
                  }
                }).catch((err) => {
                  sails.log.error(err);
                })                
              }
            }
          })
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