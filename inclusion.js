const { Driver } = require('zwave-js');

const ZWAVE_DEVICE = process.env.ZWAVE_DEVICE || '/dev/ttyACM0';

const driver = new Driver(ZWAVE_DEVICE);

driver.on('error', (err) => {
  console.log("error", err);
});

driver.once('driver ready', () => {
  console.log('Beginning inclusion...');
  driver.controller.beginInclusion();
  console.log('Inclusion has begun.');
});

(async () => {
  try {
    await driver.start();
    console.log('info', 'Z-Wave driver started.');
  } catch (err) {
    console.log('error', err);
    process.exit(1);
  }
  
})();

