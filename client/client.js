let argv = require('minimist')(process.argv.slice(2));
let socketClusterClient = require('socketcluster-client');
let cluster = require('cluster');
let os = require('os');

let testCooldownDelay = Number(argv.cooldown || 5000);

let serverHostname = argv.hostname || 'localhost';
let serverPort = Number(argv.port || 8000);
let numClients = Number(argv.clients || 1000);
// The test type.
let test = argv.test || 'many-subscribers';

let cpuCount = Number(argv.cpus || os.cpus().length);
let numClientsPerCPU = Math.round(numClients / cpuCount);

if (cluster.isMaster) {
  console.log('Test client CPUs used:', cpuCount);
  console.log('serverHostname:', serverHostname);
  console.log('serverPort:', serverPort);
  console.log('numClients:', numClients);

  let workerList = [];
  var workersReadyPromises = [];

  for (let i = 0; i < cpuCount; i++) {
    let worker = cluster.fork();
    workerList.push(worker);
    workersReadyPromises.push(
      new Promise((resolve, reject) => {
        worker.once('message', (packet) => {
          if (packet.type == 'success') {
            resolve();
          } else if (packet.type == 'error') {
            reject(new Error(packet.message));
          }
        });
      })
    );
  }

  Promise.all(workersReadyPromises)
  .then((results) => {
    console.log('All clients are connected... Waiting for CPUs to cool down before starting the test.');
    // Wait a bit before starting the test.
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, testCooldownDelay);
    });
  })
  .then(() => {
    var controlSocket = socketClusterClient.connect({
      hostname: serverHostname,
      port: serverPort,
      multiplex: false
    });

    if (test === 'many-subscribers') {
      console.log(`Starting the ${test} test.`);

      setInterval(() => {
        console.log('Publishing a single message string to the testChannel');
        controlSocket.publish('testChannel', 'hello' + Math.round(Math.random() * 1000));
      }, 1000);
    }
  })
  .catch((err) => {
    console.log('Failed to setup some workers. ' + err.message);
  });

} else {
  let socketList = [];

  for (let i = 0; i < numClientsPerCPU; i++) {
    socketList.push(
      socketClusterClient.connect({
        hostname: serverHostname,
        port: serverPort,
        multiplex: false,
        autoConnect: false
      })
    );
  }
  socketList.forEach((socket) => {
    socket.connect();
  });

  if (test === 'many-subscribers') {
    let subscribePromises = [];

    socketList.forEach((socket) => {
      let testChannel = socket.subscribe('testChannel');
      subscribePromises.push(
        new Promise((resolve, reject) => {
          testChannel.once('subscribe', () => {
            testChannel.off('subscribeFail');
            resolve();
          });
          testChannel.once('subscribeFail', (err) => {
            testChannel.off('subscribe');
            reject(err);
          });
        })
      );
    });
    Promise.all(subscribePromises)
    .then((results) => {
      process.send({type: 'success'});
    })
    .catch((err) => {
      process.send({type: 'error', message: err.message});
    });
  } else {
    console.error(`No '${test}' test exists`);
  }
}
