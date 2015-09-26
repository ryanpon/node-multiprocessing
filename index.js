'use strict';

var P       = require('bluebird');
var fork    = require('child_process').fork;

function Pool(numWorkers) {
  this.workers = [];
  for (var i = 0; i < numWorkers; i++) {
    this.workers.push(fork(__dirname + '/worker.js'));
  }
}

Pool.prototype.map = function (arr, fnOrModulePath) {
  if (!arr.length) { return []; }

  var self = this;
  self._setWorkerFunction(fnOrModulePath);

  var result = [];
  var ready = self.workers.slice();
  var nextIndex = 0;
  function enqueue() {
    while (ready.length && nextIndex < arr.length) {
      ready.pop().send({
        index: nextIndex,
        data: Pool.JSON.safeStringify(arr[nextIndex++])
      });
    }
  }

  function makeError(data) {
    var err = new Error(data.error);
    err.stack = data.stack;
    return err;
  }

  enqueue();

  var terminated = false;
  var tasksRemaining = arr.length;
  return new P(function (resolve, reject) {
    self.workers.forEach(function (worker) {
      worker.on('message', function (data) {
        if (terminated) { return; }

        if (data.error) {
          terminated = true;
          return reject(makeError(data));
        }
        result[data.index] = Pool.JSON.safeParse(data.result);

        tasksRemaining -= 1;
        if (tasksRemaining === 0) {
          return resolve(result);
        }

        ready.push(worker);
        enqueue();
      });
    });
  });
};

Pool.prototype._setWorkerFunction = function (fnOrModulePath) {
  var modulePath = typeof fnOrModulePath === 'string' ? fnOrModulePath : null;
  var fn = typeof fnOrModulePath === 'function' ? fnOrModulePath.toString() : null;
  if (!fn && !modulePath) {
    throw new Error('fnOrModulePath is a required argument');
  }
  var self = this;
  self.workers.forEach(function (worker) {
    worker.send({
      modulePath: modulePath,
      fnStr: fn
    });
  });
};

Pool.JSON = {
  reviver: function (key, value) {
    if (typeof value === 'string') {
      var regexp;
      regexp = /^\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d.\d\d\dZ$/.exec(value);
      if (regexp) {
        return new Date(value);
      }
    }
    return value;
  },
  safeStringify: function (obj) {
    return typeof obj !== 'undefined' ? JSON.stringify(obj) : obj;
  },
  safeParse: function (str) {
    return typeof str !== 'undefined' ? JSON.parse(str, Pool.JSON.reviver) : str;
  }
};

Pool.Worker = {
  activate: function () {
    var fn;
    process.on('message', function (data) {
      if (data.modulePath) {
        fn = require(data.modulePath);
      }
      if (data.fnStr) {
        eval('fn = ' + data.fnStr);  // eslint-disable-line
      }
      if ('data' in data) {
        Pool.Worker.processData(data.data, data.index, fn);
      }
    });
  },
  processData: function (data, index, fn) {
    try {
      var result = fn(Pool.JSON.safeParse(data));
      process.send({
        index: index,
        result: Pool.JSON.safeStringify(result)
      });
    } catch (err) {
      process.send({
        error: err.message,
        stack: err.stack
      });
    }
  }
};

module.exports = Pool;
