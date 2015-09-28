'use strict';

var P             = require('bluebird');
var jsonUtils     = require('./json-utils');
var WorkerWrapper = require('./worker-wrapper');
var _             = require('lodash');

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
  return this.map([arg], fnOrModulePath)
    .then(function (result) {
      return result[0];
    });
};

Pool.prototype.map = function (arr, fnOrModulePath, chunksize) {
  chunksize = chunksize || Math.ceil(arr.length / this.workers.length);
  this._assertIsUsableFnOrModulePath(fnOrModulePath);
  if (!arr || !arr.length) {
    return P.resolve([]);
  }

  var self = this;
  var result = [];
  var jobId = self._getNextJobId();
  var nextIndex = 0;
  var terminated = false;
  var tasksRemaining = arr.length;
  return new P(function (resolve, reject) {
    self.workers.forEach(function (worker) {
      worker.registerJob(jobId, fnOrModulePath, function (worker, data) {
        if (terminated) {
          return worker.deregisterJob(jobId);
        }

        if (data.error) {
          worker.deregisterJob(jobId);
          terminated = true;
          return reject(makeError(data.error, data.stack));
        }

        var resultList = jsonUtils.safeParse(data.resultList);
        for (var i = 0; i < resultList.length; i++) {
          result[data.index + i] = resultList[i];
        }

        tasksRemaining -= resultList.length;
        if (tasksRemaining <= 0) {
          worker.deregisterJob(jobId);
          return resolve(result);
        }

        if (nextIndex < arr.length) {
          // worker.runJob(jobId, nextIndex, arr[nextIndex++]);
          var chunk = arr.slice(nextIndex, nextIndex + chunksize);
          worker.runJob(jobId, nextIndex, chunk);
          nextIndex += chunksize;
        }
      });
    });

    var workerNum = 0;
    var randOffset = _.random(self.workers.length - 1);
    while (workerNum < self.workers.length && nextIndex < arr.length) {
      var chunk = arr.slice(nextIndex, nextIndex + chunksize);
      var targetWorker = self.workers[(randOffset + workerNum++) % self.workers.length];
      targetWorker.runJob(jobId, nextIndex, chunk);
      nextIndex += chunksize;
    }
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
