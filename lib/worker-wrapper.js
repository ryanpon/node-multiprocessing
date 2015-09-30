'use strict';

var fork      = require('child_process').fork;
var jsonUtils = require('./json-utils');
var _         = require('lodash');

function makeError(errorMsg, stack) {
  var err = new Error(errorMsg);
  err.stack = stack;
  return err;
}

function WorkerWrapper() {
  var self = this;
  self.process = fork(__dirname + '/worker.js');
  self.curJobId = null;
  self.runningJobs = 0;
  self.terminated = false;
  self.callbacks = {};
  self.process.on('message', function (data) {
    var err = null;
    if (data.error) {
      err = makeError(data.error, data.stack);
    }
    self.callbacks[data.jobId](err, data);
    self.runningJobs -= 1;
    if (self.terminated && self.runningJobs === 0) {
      self.process.disconnect();
    }
  });
}

WorkerWrapper.prototype.runJob = function (jobId, index, argList) {
  if (this.terminated) { return; }  // TODO: should this be an error?

  this.process.send({
    jobId   : jobId,
    index   : index,
    argList : jsonUtils.safeStringify(argList)
  });
  this.runningJobs += 1;
};

WorkerWrapper.prototype.registerJob = function (jobId, fnOrModulePath, callback) {
  if (this.terminated) { return; }  // TODO: should this be an error?

  this.callbacks[jobId] = callback;
  var modulePath = typeof fnOrModulePath === 'string' ? fnOrModulePath : null;
  var fnStr = typeof fnOrModulePath === 'function' ? fnOrModulePath.toString() : null;
  this.process.send({
    jobId      : jobId,
    modulePath : modulePath,
    fnStr      : fnStr
  });
};

WorkerWrapper.prototype.deregisterJob = function (jobId) {
  if (this.terminated) { return; }  // TODO: should this be an error?

  delete this.callbacks[jobId];
  this.process.send({
    jobId         : jobId,
    deregisterJob : true
  });
};

WorkerWrapper.prototype.terminateImmediately = function () {
  this.terminated = true;
  this.process.disconnect();
  _.forEach(this.callbacks, function (callback) {
    callback(new Error('Pool was closed'), null);
  }, this);
};

WorkerWrapper.prototype.terminateAfterJobsComplete = function () {
  this.terminated = true;
  if (this.runningJobs === 0) {
    this.process.disconnect();
  }
};

module.exports = WorkerWrapper;
