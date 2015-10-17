'use strict';

var P             = require('bluebird');
var jsonUtils     = require('./json-utils');
var WorkerWrapper = require('./worker-wrapper');
var os            = require('os');


function Pool(numWorkers) {
  this.queue = [];
  this.closed = false;
  this.workers = [];
  numWorkers = numWorkers || os.cpus().length;
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
Pool.prototype.apply = function (arg, fnOrModulePath, options) {
  return this.map([arg], fnOrModulePath, options)
    .then(function (result) {
      return result[0];
    });
};

Pool.prototype.map = function (arr, fnOrModulePath, options) {
  var self = this;
  return new P(function (resolve, reject) {
    self._queuePush(arr, fnOrModulePath, options, function (err, data) {
      return err ? reject(err) : resolve(data);
    });
  });
};

Pool.prototype._queuePush = function (arr, fnOrModulePath, options, cb) {
  options = options || {};
  var chunksize = typeof options === 'number' ? options : options.chunksize;

  if (this.closed) {
    return cb(new Error('Pool has been closed'), null);
  }
  this._assertIsUsableFnOrModulePath(fnOrModulePath);
  if (!arr || !arr.length) {
    return cb(null, []);
  }

  var job = {
    id: this._getNextJobId(),
    arr: arr,
    fnOrModulePath: fnOrModulePath,
    chunksize: chunksize || Math.ceil(arr.length / this.workers.length),
    cb: cb,
    nextIndex: 0,
    options: options
  };
  this._registerJobWithWorkers(job);
  this.queue.push(job);
  this._queueTick();
};

// TODO: wow bad name
Pool.prototype._queueTick = function () {
  while (this.queue.length && this.readyWorkers.length) {
    var job = this.queue[0];
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
    worker.registerJob(job.id, job.fnOrModulePath, job.options, function poolCb(err, data) {
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

      result[data.index] = jsonUtils.safeParse(data.result);
      tasksRemaining -= 1;
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
