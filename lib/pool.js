'use strict';

var P             = require('bluebird');
var jsonUtils     = require('./json-utils');
var WorkerWrapper = require('./worker-wrapper');

function makeError(errorMsg, stack) {
  var err = new Error(errorMsg);
  err.stack = stack;
  return err;
}

function Pool(numWorkers) {
  this.workers = [];
  this._jobs = 0;
  for (var i = 0; i < numWorkers; i++) {
    this.workers.push(new WorkerWrapper());
  }
}

// Prevents any more tasks from being submitted to the pool.
// Once all the tasks have been completed the worker processes will exit.
Pool.prototype.close = function () {

};

// Applies single argument to a function and returns result via a Promise
Pool.prototype.apply = function (arg, fnOrModulePath) {

};

Pool.prototype.map = function (arr, fnOrModulePath) {
  this._assertIsUsableFnOrModulePath(fnOrModulePath);

  var self = this;
  var jobId = self._getNextJobId();
  var result = [];

  if (!arr || !arr.length) {
    return P.resolve(result);
  }

  var ready = self.workers.slice();
  var nextIndex = 0;


  var terminated = false;
  var tasksRemaining = arr.length;
  return new P(function (resolve, reject) {
    function enqueue() {
      var cb = function (worker, data) {
        ready.push(worker);

        if (terminated) { return; }

        if (data.error) {
          terminated = true;
          reject(makeError(data.error, data.stack));
        } else {
          result[data.index] = jsonUtils.safeParse(data.result);

          tasksRemaining -= 1;
          if (tasksRemaining === 0) {
            resolve(result);
          }
        }

        enqueue();
      };

      while (ready.length && nextIndex < arr.length) {
        ready.pop().run(jobId, nextIndex, arr[nextIndex++], fnOrModulePath, cb);
      }
    }

    enqueue();
  });
};


Pool.prototype._assertIsUsableFnOrModulePath = function (fnOrModulePath) {
  if (typeof fnOrModulePath !== 'function' && typeof fnOrModulePath !== 'string') {
    throw new Error('fnOrModulePath must be a function or a string');
  }
};

Pool.prototype._getNextJobId = function () {
  return this._jobs++;
};

module.exports = Pool;
