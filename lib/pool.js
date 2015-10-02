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
  this.queue = [];
  this.closed = false;
  this.workers = [];
  for (var i = 0; i < numWorkers; i++) {
    // TODO: should support more worker types here..like WebWorkers
    this.workers.push(new WorkerWrapper());
  }
  this.readyWorkers = this.workers.slice();
  this._nextJobId = 0;
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
  if (this.closed) {
    return cb(new Error('Pool has been closed'), null);
  }
  this._assertIsUsableFnOrModulePath(fnOrModulePath);
  if (!arr || !arr.length) {
    return cb(null, []);
  }

  this.queue.push({
    id: this._getNextJobId(),
    arr: arr,
    fnOrModulePath: fnOrModulePath,
    chunksize: chunksize || Math.ceil(arr.length / this.workers.length),
    cb: cb,
    nextIndex: 0
  });
  this._queueTick();
};

// TODO: wow bad name
Pool.prototype._queueTick = function () {
  while (this.queue.length && this.readyWorkers.length) {
    var job = this.queue[0];
    if (job.nextIndex === 0) {
      this._registerJobWithWorkers(job);
    }
    var chunk = job.arr.slice(job.nextIndex, job.nextIndex + job.chunksize);
    this.readyWorkers.pop().runJob(job.id, job.nextIndex, chunk);
    job.nextIndex += job.chunksize;
    if (job.nextIndex >= job.arr.length) {
      this.queue.shift();
    }
  }
};

Pool.prototype._registerJobWithWorkers = function (job) {
  var self = this;
  var result = [];
  var tasksRemaining = job.arr.length;
  var jobTerminated = false;
  self.workers.forEach(function (worker) {
    worker.registerJob(job.id, job.fnOrModulePath, function poolCb(err, data) {
      self.readyWorkers.push(worker);
      self._queueTick();

      if (jobTerminated) {
        return worker.deregisterJob(job.id);
      }

      if (err) {
        worker.deregisterJob(job.id);
        jobTerminated = true;
        return job.cb(err, null);
      }

      var resultList = jsonUtils.safeParse(data.resultList);
      spliceArr(result, resultList, data.index);

      tasksRemaining -= resultList.length;
      if (tasksRemaining <= 0) {
        worker.deregisterJob(job.id);
        return job.cb(null, result);
      }
    });
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
