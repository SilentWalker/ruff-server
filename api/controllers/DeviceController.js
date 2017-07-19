/**
 * DeviceController
 *
 * @description :: Server-side logic for managing devices
 * @help        :: See http://sailsjs.org/#!/documentation/concepts/Controllers
 */
const pubsub = sails.config.pubsub;
module.exports = {
	publishMsg : (req, res) => {
    let clientId = req.body.clientId;
    let msg = req.body.msg;
    pubsub.emit('msg', clientId, msg);
    return res.ok();
  }
};

