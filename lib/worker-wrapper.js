'use strict';

var fork      = require('child_process').fork;
var jsonUtils = require('./json-utils');
var _         = require('lodash');

function WorkerWrapper() {
  var self = this;
  self.process = fork(__dirname + '/worker.js');
  self.curJobId = null;
  self.runningJobs = 0;
  self.terminated = false;
  self.callbacks = {};
  self.process.on('message', function (data) {
    self.callbacks[data.jobId](self, data);
    self.runningJobs -= 1;
    if (self.terminated && self.runningJobs === 0) {
      self.process.disconnect();
    }
  });
}

WorkerWrapper.prototype.runJob = function (jobId, index, argList) {
  if (this.terminated) {
    return;  // TODO: should this be an error?
  }
  this.process.send({
    jobId   : jobId,
    index   : index,
    argList : jsonUtils.safeStringify(argList)
  });
  this.runningJobs += 1;
};

WorkerWrapper.prototype.registerJob = function (jobId, fnOrModulePath, callback) {
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
  delete this.callbacks[jobId];
  this.process.send({
    jobId         : jobId,
    deregisterJob : true
  });
};

WorkerWrapper.prototype.terminateImmediately = function () {
  var self = this;
  self.terminated = true;
  self.process.disconnect();
  _.forEach(self.callbacks, function (callback) {
    callback(self, null);
  });
};

WorkerWrapper.prototype.terminateAfterJobsComplete = function () {
  this.terminated = true;
  if (this.runningJobs === 0) {
    this.process.disconnect();
  }
};

module.exports = WorkerWrapper;
