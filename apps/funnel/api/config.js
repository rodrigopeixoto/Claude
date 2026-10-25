const { send, handler } = require('../lib/http');
const { loadConfig, publicConfig } = require('../lib/config');

module.exports = handler(['GET'], (req, res) => {
  send(res, 200, publicConfig(loadConfig()));
});
