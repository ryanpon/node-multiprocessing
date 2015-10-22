'use strict';

var fork      = require('child_process').fork;
var jsonUtils = require('./json-utils');

var allWorkers = [];
process.on('exit', function () {
  allWorkers.forEach(function (worker) {
    worker.process.kill();
  });
});

function makeError(errorMsg, stack) {
  var err = new Error(errorMsg);
  err.stack = stack;
  return err;
}

function WorkerWrapper() {
  this.process = null;
  this.runningJobs = 0;
  this.terminated = false;
  this.registeredJobs = {};
  this.fnOrModulePaths = {};
  this.timeout = null;

  this.startWorkerProcess();
  allWorkers.push(this);
}

WorkerWrapper.prototype.startWorkerProcess = function () {
  var self = this;
  self.process = fork(__dirname + '/worker.js');
  for (var regJobId in self.registeredJobs) {
    if (self.registeredJobs.hasOwnProperty(regJobId)) {
      var job = self.registeredJobs[regJobId];
      self.registerJob(regJobId, job.fnOrModulePath, job.callback);
    }
  }
  self.process.on('message', function (data) {
    var job = self.registeredJobs[data.jobId];
    if (job.terminated) {
      return;
    }
    clearTimeout(self.timeout);
    var err = null;
    if (data.error) {
      err = makeError(data.error, data.stack);
    }
    job.callback(err, data);
    if (data.jobDone) {
      self.runningJobs -= 1;
    } else if (job.timeout > 0) {
      self.startJobTimeout(job);
    }
    if (self.terminated && self.runningJobs === 0) {
      self.process.disconnect();
    }
  });
};

WorkerWrapper.prototype.runJob = function (jobId, index, argList) {
  if (this.terminated) { return; }  // TODO: should this be an error?

  var self = this;
  self.process.send({
    jobId   : jobId,
    index   : index,
    argList : jsonUtils.safeStringify(argList)
  });
  self.runningJobs += 1;

  var job = self.registeredJobs[jobId];
  if (job.timeout > 0) {
    self.startJobTimeout(job);
  }
};

WorkerWrapper.prototype.registerJob = function (jobId, fnOrModulePath, options, callback) {
  if (this.terminated) { return; }  // TODO: should this be an error?

  this.registeredJobs[jobId] = {
    callback: callback,
    fnOrModulePath: fnOrModulePath,
    timeout: options.timeout || -1
  };
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

  delete this.registeredJobs[jobId];
  this.process.send({
    jobId         : jobId,
    deregisterJob : true
  });
};

WorkerWrapper.prototype.terminateImmediately = function () {
  this.terminated = true;
  this.process.disconnect();
  for (var cbName in this.registeredJobs) {
    if (this.registeredJobs.hasOwnProperty(cbName)) {
      this.registeredJobs[cbName].callback(new Error('Pool was closed'), null);
    }
  }
};

WorkerWrapper.prototype.terminateAfterJobsComplete = function () {
  this.terminated = true;
  if (this.runningJobs === 0) {
    this.process.disconnect();
  }
};

WorkerWrapper.prototype.startJobTimeout = function (job) {
  var self = this;
  self.timeout = setTimeout(function () {
    job.terminated = true;
    self.process.kill();
    self.startWorkerProcess();
    job.callback(new Error('Task timed out'), null);
  }, job.timeout);
};

module.exports = WorkerWrapper;
