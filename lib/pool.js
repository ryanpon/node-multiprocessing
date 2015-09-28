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
  this.queue = [];
  this.queueRunning = false;
  this._jobs = 0;
  this.closed = false;
  this.terminated = false;
  this.workers = [];
  for (var i = 0; i < numWorkers; i++) {
    this.workers.push(new WorkerWrapper());
  }
}

// Prevents any more tasks from being submitted to the pool.
// Once all the tasks have been completed the worker processes will exit.
Pool.prototype.close = function () {
  this.closed = true;
  this.workers.forEach(function (worker) {
    worker.terminateAfterJobsComplete();
  });
};

// Stops the worker processes immediately without completing outstanding work.
Pool.prototype.terminate = function () {
  this.closed = this.terminated = true;
  this.workers.forEach(function (worker) {
    worker.terminateImmediately();
  });
};

// Applies single argument to a function and returns result via a Promise
Pool.prototype.apply = function (arg, fnOrModulePath) {
  return this.map([arg], fnOrModulePath, 1)
    .then(function (result) {
      return result[0];
    });
};

Pool.prototype.map = function (arr, fnOrModulePath, chunksize) {
  var self = this;
  return new P(function (resolve, reject) {
    self._queuePush(arr, fnOrModulePath, chunksize, function (err, data) {
      err ? reject(err) : resolve(data);
    });
  });
};

Pool.prototype._queuePush = function (arr, fnOrModulePath, chunksize, cb) {
  this.queue.push([arr, fnOrModulePath, chunksize, cb]);
  if (!this.queueRunning) {
    this.queueRunning = true;
    this._queueShift();
  }
};

Pool.prototype._queueShift = function () {
  var self = this;
  var jobArgs = self.queue.shift();
  var jobCb = jobArgs[3];
  var queueCb = function (err, data) {
    jobCb(err, data);
    if (self.queue.length) {
      self._queueShift();
    } else {
      self.queueRunning = false;
    }
  };
  self._processJob(jobArgs[0], jobArgs[1], jobArgs[2], queueCb);
};

Pool.prototype._processJob = function (arr, fnOrModulePath, chunksize, cb) {
  if (this.closed) {
    return cb(new Error('Pool has been closed'), null);
  }

  chunksize = chunksize || Math.ceil(arr.length / this.workers.length);
  this._assertIsUsableFnOrModulePath(fnOrModulePath);
  if (!arr || !arr.length) {
    return cb(null, []);
  }

  var self = this;
  var result = [];
  var jobId = self._getNextJobId();
  var nextIndex = 0;
  var terminated = false;
  var tasksRemaining = arr.length;
  self.workers.forEach(function (worker) {
    worker.registerJob(jobId, fnOrModulePath, function (worker, data) {
      if (self.terminated) {
        return cb(new Error('Pool was closed'), null);
      }

      if (terminated) {
        return worker.deregisterJob(jobId);
      }

      if (data.error) {
        worker.deregisterJob(jobId);
        terminated = true;
        return cb(makeError(data.error, data.stack), null);
      }

      var resultList = jsonUtils.safeParse(data.resultList);
      for (var i = 0; i < resultList.length; i++) {
        result[data.index + i] = resultList[i];
      }

      tasksRemaining -= resultList.length;
      if (tasksRemaining <= 0) {
        worker.deregisterJob(jobId);
        return cb(null, result);
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
