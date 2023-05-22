const { Driver } = require('zwave-js');
const prometheus = require('prom-client');
const http = require('http');

const LOG_LEVELS = { 'debug': 1, 'info': 2, 'warn': 3, 'error': 4 };
const LOG_LEVEL = LOG_LEVELS[process.env.LOGLEVEL] || LOG_LEVELS.info;
const METRICS_PORT = process.env.METRICS_PORT || 9026;
const TIMESTAMPS = process.env.TIMESTAMPS || false;
const ZWAVE_DEVICE = process.env.ZWAVE_DEVICE || '/dev/ttyACM0';
const ZWAVE_INTERVAL = process.env.ZWAVE_INTERVAL || 60; /* in seconds */
const MAX_RSS = parseInt(process.env.MAX_RSS, 10) || 0; /* in bytes */


const metrics = {};
const unit_mapping = {
  'A': '_amperes',
  '°C': '_celsius',
  'kWh': '_kwh',
  '%': '_percent',
  'ppm': '_ppm',
  'V': '_volts',
  'W': '_watts',
}


// "level" should be a Node log level (debug, info, warn, or error)
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
  if (! (level in LOG_LEVELS)) {
    kv.original_level = level;
    level = "error";
  }
  kv.log = message;
  if (LOG_LEVELS[level] >= LOG_LEVEL) {
    console[level](JSON.stringify(kv));
  }
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
        'value.endpoint': value.endpoint,
        'value.propertyName': value.propertyName,
        'value.propertyKeyName': value.propertyKeyName,
        'value.value': value.newValue,
      });
      let value_metadata = node.getValueMetadata(value);
      let value_unit = value_metadata.unit;
      let unit_string = unit_mapping[value_unit] || '_unknownunit';
      let value_name = value.propertyKeyName || value.propertyName;
      let metric_name = 'zwave_' + value_name
        .toLowerCase()
        .replace(/ /g, '_')
        .replace(/₂/g, '2')
        .replace(/[()]/g, '')
        + unit_string;
      if (! (metric_name in metrics) ) {
        log('info', 'registering new metric', {'metric': metric_name });
        metrics[metric_name] = new prometheus.Gauge({
          name: metric_name,
          help: value_metadata.label,
          labelNames: [ 'node', 'endpoint' ],
        });
      }
      metrics[metric_name].set({ node: node.id, endpoint: value.endpoint }, value.newValue);
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

if (MAX_RSS > 0) {
  log('info', `Program will automatically exit when RSS reaches ${MAX_RSS} bytes.`);
  setInterval(function () {
    const { rss } = process.memoryUsage();
    if (rss > MAX_RSS) {
      log('error', `RSS (${rss}) exceeded MAX_RSS (${MAX_RSS}). Exiting.`);
      process.exit(1);
    }
  }, 60 * 1000);
}

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

