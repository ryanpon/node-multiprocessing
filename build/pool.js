'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var jsonUtils = require('./json-utils');
var WorkerWrapper = require('./worker-wrapper');
var P = require('bluebird');
var os = require('os');

module.exports = function () {
  function Pool(numWorkers) {
    _classCallCheck(this, Pool);

    numWorkers = numWorkers || os.cpus().length;

    this.queue = [];
    this.closed = false;
    this.workers = Array.from(new Array(numWorkers)).map(function () {
      return new WorkerWrapper();
    });
    this.readyWorkers = this.workers.slice();
    this._nextJobId = 0;
  }

  // Prevents any more tasks from being submitted to the pool.
  // Once all the tasks have been completed the worker processes will exit.


  _createClass(Pool, [{
    key: 'close',
    value: function close() {
      this.closed = true;
      this.workers.forEach(function (worker) {
        return worker.terminateAfterJobsComplete();
      });
    }

    // Stops the worker processes immediately without completing outstanding work.

  }, {
    key: 'terminate',
    value: function terminate() {
      this.closed = true;
      this.workers.forEach(function (worker) {
        return worker.terminateImmediately();
      });
    }
  }, {
    key: 'define',
    value: function define(name, fnOrModulePath, options) {
      var _this = this;

      if (this.hasOwnProperty(name)) {
        throw new Error('Pool already has a property "' + name + '"');
      }
      this[name] = {
        map: function map(arg) {
          return _this.map(arg, fnOrModulePath, options);
        },
        apply: function apply(arg) {
          return _this.apply(arg, fnOrModulePath, options);
        }
      };
    }

    // Applies single argument to a function and returns result via a Promise

  }, {
    key: 'apply',
    value: function apply(arg, fnOrModulePath, options) {
      return this.map([arg], fnOrModulePath, options).spread(function (result) {
        return result;
      });
    }
  }, {
    key: 'map',
    value: function map(arr, fnOrModulePath, options) {
      var _this2 = this;

      return new P(function (resolve, reject) {
        return _this2._queuePush(arr, fnOrModulePath, options, function (err, data) {
          return err ? reject(err) : resolve(data);
        });
      });
    }
  }, {
    key: '_queuePush',
    value: function _queuePush(arr, fnOrModulePath, options, cb) {
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
    }
  }, {
    key: '_queueTick',
    value: function _queueTick() {
      while (this.queue.length && this.readyWorkers.length) {
        var job = this.queue[0];
        var chunk = job.arr.slice(job.nextIndex, job.nextIndex + job.chunksize);
        this.readyWorkers.pop().runJob(job.id, job.nextIndex, chunk);
        job.nextIndex += job.chunksize;
        if (job.nextIndex >= job.arr.length) {
          this.queue.shift();
        }
      }
    }
  }, {
    key: '_registerJobWithWorkers',
    value: function _registerJobWithWorkers(job) {
      var _this3 = this;

      var result = [];
      var tasksRemaining = job.arr.length;
      var jobTerminated = false;
      this.workers.forEach(function (worker) {
        worker.registerJob(job.id, job.fnOrModulePath, job.options, function (err, data) {
          _this3.readyWorkers.push(worker);
          _this3._queueTick();

          if (jobTerminated) {
            return worker.deregisterJob(job.id);
          }

          if (err) {
            worker.deregisterJob(job.id);
            jobTerminated = true;
            return job.cb(err, null);
          }

          result[data.index] = jsonUtils.safeParse(data.result);
          if (job.options && job.options.onResult) {
            job.options.onResult(result[data.index], data.index);
          }
          tasksRemaining -= 1;
          if (tasksRemaining <= 0) {
            worker.deregisterJob(job.id);
            return job.cb(null, result);
          }
        });
      });
    }
  }, {
    key: '_assertIsUsableFnOrModulePath',
    value: function _assertIsUsableFnOrModulePath(fnOrModulePath) {
      if (typeof fnOrModulePath !== 'function' && typeof fnOrModulePath !== 'string') {
        throw new Error('fnOrModulePath must be a function or a string');
      }
    }
  }, {
    key: '_getNextJobId',
    value: function _getNextJobId() {
      return this._nextJobId++;
    }
  }]);

  return Pool;
}();