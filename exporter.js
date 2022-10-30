const { Driver } = require('zwave-js');
const prometheus = require('prom-client');
const http = require('http');


process.env.LOGLEVEL = process.env.LOGLEVEL || 'warn';
const METRICS_PORT = process.env.METRICS_PORT || 9026;
const TIMESTAMPS = process.env.TIMESTAMPS || false;
const ZWAVE_DEVICE = process.env.ZWAVE_DEVICE || '/dev/ttyACM0';
const ZWAVE_INTERVAL = process.env.ZWAVE_INTERVAL || 60; /* in seconds */


const metrics = {};
const unit_mapping = {
  '°C': '_celsius',
  '%': '_percent',
  'ppm': '_ppm',
}


// "level" should be a Node log level (warn, error, info, debug, etc.)
// "message" should be a string
// "kv" is an optional object with extra parameteres to be logged
function log(level, message, kv) {
  if (kv === undefined) {
    kv = {};
  }
  if (TIMESTAMPS) {
    kv.t = new Date().toJSON();
  }
  kv.level = level;
  if (! (level in console)) {
    kv.original_level = level;
    level = "error";
  }
  kv.log = message;
  console[level](JSON.stringify(kv));
}


const driver = new Driver(ZWAVE_DEVICE);

driver.on('error', (err) => {
  log("error", err);
});

driver.once('driver ready', () => {
  driver.controller.nodes.forEach(async (node) => {
    log('info', 'new node detected', {
      'node.id': node.id,
      'node.label': node.label,
      'node.class': node.deviceClass.generic.label,
    });
    node.on('value updated', (node, value) => {
      log('debug', 'value updated', {
        'node.id': node.id,
        'node.label': node.label,
        'value.name': value.propertyName,
        'value.value': value.newValue,
      });
      let value_metadata = node.getValueMetadata(value);
      let value_unit = value_metadata.unit;
      let unit_string = unit_mapping[value_unit] || '_unknownunit';
      let metric_name = value
        .propertyName.toLowerCase()
        .replace(/ /g, '_')
        .replace(/₂/g, '2')
        .replace(/[()]/g, '')
        + unit_string;
      if (! (metric_name in metrics) ) {
        log('info', 'registering new metric', {'metric': metric_name });
        metrics[metric_name] = new prometheus.Gauge({
          name: metric_name,
          help: value.property,
          labelNames: [ 'node' ],
        });
      }
      metrics[metric_name].set({ node: node.id }, value.newValue);
    });
    if (ZWAVE_INTERVAL > 0) {
      log('info', `we will actively ask node ${node.id} to refresh its values every ${ZWAVE_INTERVAL} seconds`);
      setInterval(() => { 
        node.refreshValues().then();
      }, ZWAVE_INTERVAL * 1000);
      node.refreshValues().then();
    } else {
      log('info', `ZWAVE_INTERVAL is zero, so we will not poll node ${node.id} (we will only receive data passively)`);
    }
  });
});

(async () => {
  try {
    await driver.start();
    log('info', 'Z-Wave driver started.');
  } catch (err) {
    log('error', err);
    process.exit(1);
  }
  
  const server = http.createServer(async (req, res) => {
    if (req.url == '/metrics' && req.method == 'GET') {
      res.writeHead(200, { 'content-type': prometheus.register.contentType });
      res.end(await prometheus.register.metrics());
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  server.listen(METRICS_PORT);
  log('info', `Prometheus metrics exporter listening on port ${METRICS_PORT}.`);
})();

