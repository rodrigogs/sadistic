const PQueue = require('p-queue');
const got = require('got');
const { parentPort, workerData } = require('worker_threads');

const {
  url, options = {}, concurrency = 100,
} = workerData;

if (!url) throw new Error('Url not specified');

const queue = new PQueue({ concurrency });

parentPort.on('message', (value) => {
  const { channelPort } = value;

  if (!channelPort) process.exit(400);

  Array(concurrency).fill(undefined).forEach(() => queue.add(async () => {
    try {
      channelPort.postMessage({ type: 'request' });
      const { statusCode, body } = await got(url, options);
      channelPort.postMessage({ type: 'response', value: { statusCode, body } });
    } catch (err) {
      channelPort.postMessage({ type: 'error', value: err.toString() });
    }
  }));
});

queue.onEmpty(() => process.exit(0));
