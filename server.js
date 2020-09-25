const util = require('util');
const http = require('http');
const express = require('express');
const helmet = require('helmet');
const limit = require('express-rate-limit');
const stoppable = require('stoppable');
const fs = require('fs');

const exec = util.promisify(require('child_process').exec);

const LOGLVL = {
  'VERBOSE': 3,
  'DEBUG': 2,
  'INFO': 1,
}[process.argv.slice(2)[0]] || 0;

const COMMAND =
'LINES=$(docker stats --no-stream | grep -v "CONTAINER"); ' +
'echo "{ \\"date\\":\\"`date "+%Y-%m-%d %H:%M:%S"`\\""; ' +
'while read -r LINE; do ' +
'echo "$LINE" | sed -En \'s/^[^[:space:]]+[[:space:]]+([^[:space:]]+)[[:space:]]+([^[:space:]]+)[[:space:]]+([^[:space:]]+) [/] ([^[:space:]]+)[[:space:]]+[^[:space:]]+[[:space:]]+([^[:space:]]+) [/] ([^[:space:]]+)[[:space:]]+([^[:space:]]+) [/] ([^[:space:]]+)[[:space:]]+([[:digit:]]+)$/, "\\1":{"cpu":"\\2","memu":"\\3","memt":"\\4","neti":"\\5","neto":"\\6","blki":"\\7","blko":"\\8","pids":"\\9"}/gp\'; ' +
'done <<< "$LINES"; '+
'echo "}"';

const PORT = 54321;
const RUN_INTERVAL = 60000;
const DATA_POINTS = 1000;
const DATA_FILE = 'data.json';

let threadId;
const dataPoints = [];

const read = () => {
  try {
    fs.access(DATA_FILE, fs.F_OK, (err) => {
      if (err) { // data file exists
        if (LOGLVL > 0) console.log('No previous data file found');
        stats();
      } else {
        dataPoints.splice(0, dataPoints.length);
        fs.readFile(DATA_FILE, (err, input) => {
          if (err) {
            console.log('Error reading data file', err);
          } else {
            const data = JSON.parse(input);
            console.log(`Read ${data.length} data points from ${DATA_FILE}`);
            dataPoints.push(...data.filter((d, i) => (data.length <= DATA_POINTS) ? true : (i >= (data.length - DATA_POINTS))));
          }
          stats();
        });
      }
    });
  } catch (error) {
    console.log('Error reading data file', error);
  }
};

const stats = async () => {
  try {
    const {stdout, stderr} = await exec(COMMAND);
    if (stderr) {
      console.log(stderr);
    } else {
      const result = JSON.parse(stdout);
      dataPoints.push(result);
      if (dataPoints.length > DATA_POINTS) dataPoints.shift();
      fs.writeFile(DATA_FILE, JSON.stringify(dataPoints), err => {
        if (err) {
          console.log('Error writing data file', err);
        } else {
          if (LOGLVL > 1) console.log(`${dataPoints.length} data points written to ${DATA_FILE} at ${dataPoints[dataPoints.length - 1].date}`);
        }
      });

      switch (LOGLVL) {
        case 3:
          console.log(JSON.stringify(result));
          break;
        case 2:
        case 1:
          console.log(`${dataPoints.length} data points available at ${dataPoints[dataPoints.length - 1].date}`);
          break;
      }
    }
  } catch (error) {
    console.log('Error running command', error);
  }
};

const start = () => {
  if (!threadId) {
    read();
    const msg = `Starting data collection every ${RUN_INTERVAL/1000}s with a buffer of ${DATA_POINTS}...`;
    threadId = setInterval(() => stats(), RUN_INTERVAL);
    console.log(msg);
    return msg;
  } else {
    const msg = `Data collection service started already with ${dataPoints.length} data available`;
    console.log(msg);
    return msg;
  }
};

const stop = () => {
  if (threadId) {
    const msg = 'Stopping data collection service...';
    clearInterval(threadId);
    threadId = undefined;
    console.log(msg);
    return msg;
  } else {
    const msg = 'Data collection service not start';
    console.log(msg);
    return msg;
  }
};

(async () => {
  const app = express();
  app.set('trust proxy', 1); // trust first proxy
  app.use(helmet());

  let limiter = new limit({
    windowMs: 900000, // 900,000 == 15*60*1000 == 15 minutes
    max: 300,
    delayMs: 0 // disabled
  });
  app.use(limiter);

  app.get('/', (req, res) => res.send('docker stats'));
  app.post('/stats/start', (req, res) => {
    res.send(start());
  });
  app.post('/stats/stop', (req, res) => {
    res.send(stop());
  });
  app.get('/stats', async (req, res) => {
    res.send(dataPoints);
  });

  const server = stoppable(http.createServer(app));
  const shutdown = () => {
    return new Promise(async (resolve, reject) => {
      stop();
      server.stop(err => {
        if (err) {
          console.log('An error occured while stopping the server', err);
          reject();
        } else {
          console.log('Server stopped');
          resolve();
        }
      });
    });
  }

  process.on('SIGINT', async () => {
    await shutdown()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  });
  process.on('SIGTERM', async () => {
    await shutdown()
      .then(() => process.exit(0))
      .catch(() => process.exit(1));
  });
  process.on('uncaughtException', err => {
    console.log('Uncaught exception', err);
  });

  start();
  server.listen(PORT, () => console.log('🚀 Server listening on port', PORT));
})().catch(error => {
  console.log('Error starting server', error);
  process.exit(1);
});
