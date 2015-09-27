'use strict';

var fork      = require('child_process').fork;
var jsonUtils = require('./json-utils');

function WorkerWrapper() {
  var self = this;
  self.process = fork(__dirname + '/worker.js');
  self.curJobId = null;
  self.cb = function () {
    throw new Error('No callback set');
  };
  self.process.on('message', function (data) {
    self.cb(self, data);
  });
}

WorkerWrapper.prototype.setCallback = function (cb) {
  if (typeof cb !== 'function') {
    throw new Error('Callback must be a function');
  }
  this.cb = cb;
};

WorkerWrapper.prototype.run = function (jobId, subJobId, arg, fnOrModulePath, cb) {
  if (this.curJobId !== jobId) {
    this.curJobId = jobId;
    this._setWorkerFunction(fnOrModulePath);
  }
  this.setCallback(cb);

  this.process.send({
    index: subJobId,
    data: jsonUtils.safeStringify(arg)
  });
};
WorkerWrapper.prototype._setWorkerFunction = function (fnOrModulePath) {
  var modulePath = typeof fnOrModulePath === 'string' ? fnOrModulePath : null;
  var fn = typeof fnOrModulePath === 'function' ? fnOrModulePath.toString() : null;
  this.process.send({
    modulePath: modulePath,
    fnStr: fn
  });
};

module.exports = WorkerWrapper;
