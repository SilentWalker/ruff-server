/**
 * EnvController
 *
 * @description :: Server-side logic for managing envs
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */

module.exports = {
	tempAndHumi : (req, res) => {
    let clientId = req.query.clientId;
    sails.services.redis.hget(clientId, 'temp', (err, temp) => {
      if(err) {
        sails.log.error(`#### EnvController : tempAndhumi get temp failed ####`);
        return res.serverError(err);
      }
      sails.services.redis.hget(clientId, 'humi', (err, humi) => {
        if(err) {
          sails.log.error(`#### EnvController : tempAndHumi get humi failed ####`);
          return res.serverError(err);
        }
        return res.ok({
          temp,
          humi
        })
      })
    })
  }
};

