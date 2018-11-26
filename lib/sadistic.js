const path = require('path');
const { cpus, EOL } = require('os');
const { Worker, MessageChannel } = require('worker_threads');

const cores = cpus().length;
let requests = 0;
let responses = 0;
let errors = 0;

const startRequestWorkers = ({
  url, options, concurrency, threads = cores,
}) => {
  const threadsLength = Array(threads).fill(undefined);
  const workerPromises = threadsLength.map((val, index) => new Promise((resolve, reject) => {
    const thread = index + 1;
    const log = (...messages) => process.stdout.write(`Worker[${thread}]: ${messages.join(' ')}${EOL}`);
    const channel = new MessageChannel();

    const worker = new Worker(path.resolve(__dirname, './request_worker.js'), {
      workerData: {
        url,
        options,
        concurrency,
      },
    });

    worker.postMessage({ channelPort: channel.port1 }, [channel.port1]);

    let workerRequests = 0;
    let workerResponses = 0;
    let workerErrors = 0;

    channel.port2.on('message', (message) => {
      switch (message.type) {
        case 'request':
          requests += 1;
          workerRequests += 1;
          break;
        case 'response':
          responses += 1;
          workerResponses += 1;
          break;
        case 'error':
          errors += 1;
          workerErrors += 1;
          break;
        default:
          log(`Unknown message type "${message.type}" with value ${message.value}`);
      }

      log(`Req: ${requests} Res: ${responses} Err: ${errors} WReq: ${workerRequests} WRes: ${workerResponses} WErr: ${workerErrors}`, ' | ', message.type, JSON.stringify(message.value));
    });

    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) return reject(new Error(`Worker[${thread}] stopped with exit code ${code}`));
      return resolve();
    });
  }));

  return Promise.all(workerPromises);
};

module.exports = args => startRequestWorkers(args);
