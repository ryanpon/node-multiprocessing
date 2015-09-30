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
  this.queueRunning = false;
  this.closed = false;
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
  if (!this.queueRunning) {
    this.queueRunning = true;
    this._queueShift();
  }
};

// TODO: this should utilize ready workers even when previous task isn't done
Pool.prototype._queueShift = function () {
  var self = this;
  var jobArgs = self.queue.shift();
  var jobCb = jobArgs[3];
  self._processJob(jobArgs[0], jobArgs[1], jobArgs[2], function (err, data) {
    jobCb(err, data);
    if (self.queue.length) {
      self._queueShift();
    } else {
      self.queueRunning = false;
    }
  });
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

  var result = [];
  var jobId = this._getNextJobId();
  var nextIndex = 0;
  var jobTerminated = false;
  var tasksRemaining = arr.length;
  function runNextJobChunk(worker) {
    if (nextIndex < arr.length) {
      var chunk = arr.slice(nextIndex, nextIndex + chunksize);
      worker.runJob(jobId, nextIndex, chunk);
      nextIndex += chunksize;
    }
  }
  this.workers.forEach(function (worker) {
    worker.registerJob(jobId, fnOrModulePath, function (err, data) {
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

      runNextJobChunk(worker);
    });

    runNextJobChunk(worker);
  });
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
