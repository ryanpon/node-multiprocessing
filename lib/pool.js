'use strict';

var P             = require('bluebird');
var jsonUtils     = require('./json-utils');
var WorkerWrapper = require('./worker-wrapper');

function spliceArr(toArr, fromArr, startIndex) {
  for (var i = 0; i < fromArr.length; i++) {
    toArr[startIndex + i] = fromArr[i];
  }
}

function Pool(numWorkers) {
  this._nextJobId = 0;
  this.queue = [];
  this.numJobsRunning = 0;
  this.closed = false;
  this.workers = [];
  for (var i = 0; i < numWorkers; i++) {
    // TODO: should support more worker types here..like WebWorkers
    this.workers.push(new WorkerWrapper());
  }
  this.readyWorkers = this.workers.slice();
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
  this.closed = true;
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
      return err ? reject(err) : resolve(data);
    });
  });
};

Pool.prototype._queuePush = function (arr, fnOrModulePath, chunksize, cb) {
  this.queue.push([arr, fnOrModulePath, chunksize, cb]);
  if (this.numJobsRunning === 0) {
    this._queueShift();
  }
};

Pool.prototype._queueShift = function () {
  var self = this;
  if (!self.queue.length) { return; }
  var jobArgs = self.queue.shift();
  var jobCb = jobArgs[3];
  self.numJobsRunning += 1;
  self._processJob(jobArgs[0], jobArgs[1], jobArgs[2], function (err, data) {
    jobCb(err, data);
    self.numJobsRunning -= 1;
    if (self.queue.length && self.numJobsRunning === 0) {
      self._queueShift();
    }
  });
};

Pool.prototype._processJob = function (arr, fnOrModulePath, chunksize, cb) {
  var self = this;
  if (self.closed) {
    return cb(new Error('Pool has been closed'), null);
  }

  chunksize = chunksize || Math.ceil(arr.length / self.workers.length);
  self._assertIsUsableFnOrModulePath(fnOrModulePath);
  if (!arr || !arr.length) {
    return cb(null, []);
  }

  var result = [];
  var jobId = self._getNextJobId();
  var nextIndex = 0;
  var jobTerminated = false;
  var tasksRemaining = arr.length;
  var isLatestTask = true;
  function runJobChunks() {
    while (self.readyWorkers.length && nextIndex < arr.length) {
      var chunk = arr.slice(nextIndex, nextIndex + chunksize);
      self.readyWorkers.pop().runJob(jobId, nextIndex, chunk);
      nextIndex += chunksize;
    }
    setTimeout(function () {
      if (self.readyWorkers.length && self.queue.length && isLatestTask) {
        isLatestTask = false;
        self._queueShift();
      }
    }, 10);

  }

  self.workers.forEach(function (worker) {
    worker.registerJob(jobId, fnOrModulePath, function poolCb(err, data) {
      self.readyWorkers.push(worker);

      if (jobTerminated) {
        return worker.deregisterJob(jobId);
      }

      if (err) {
        worker.deregisterJob(jobId);
        jobTerminated = true;
        return cb(err, null);
      }

      var resultList = jsonUtils.safeParse(data.resultList);
      spliceArr(result, resultList, data.index);

      tasksRemaining -= resultList.length;
      if (tasksRemaining <= 0) {
        worker.deregisterJob(jobId);
        return cb(null, result);
      }

      runJobChunks();
    });
  });

  runJobChunks();
};

Pool.prototype._assertIsUsableFnOrModulePath = function (fnOrModulePath) {
  if (typeof fnOrModulePath !== 'function' && typeof fnOrModulePath !== 'string') {
    throw new Error('fnOrModulePath must be a function or a string');
  }
};

Pool.prototype._getNextJobId = function () {
  return this._nextJobId++;
};

module.exports = Pool;
