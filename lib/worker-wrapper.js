'use strict';

var fork      = require('child_process').fork;
var jsonUtils = require('./json-utils');

function WorkerWrapper() {
  var self = this;
  self.process = fork(__dirname + '/worker.js');
  self.curJobId = null;
  self.callbacks = {};
  self.process.on('message', function (data) {
    self.callbacks[data.jobId](self, data);
  });
}

WorkerWrapper.prototype.runJob = function (jobId, index, arg) {
  this.process.send({
    jobId: jobId,
    index: index,
    data: jsonUtils.safeStringify(arg)
  });
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

module.exports = WorkerWrapper;
