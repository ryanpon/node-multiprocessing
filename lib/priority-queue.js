'use strict';

var Pool = require('./pool');
var Heap = require('./heap');
var P    = require('bluebird');

function PriorityQueue(numWorkers) {
  this.numReadyWorkers = numWorkers;
  this.pool = new Pool(numWorkers);
  this.heap = new Heap();
}

PriorityQueue.prototype.push = function (arg, priority, fnOrModulePath, options) {
  var self = this;
  if (self.numReadyWorkers) {
    self.numReadyWorkers -= 1;
    return self.pool.apply(arg, fnOrModulePath, options)
      .finally(function () {
        self.numReadyWorkers += 1;
        self._tick();
      });
  }

  return new P(function (resolve, reject) {
    self.heap.insert(priority, {
      args: [arg, fnOrModulePath, options],
      resolve: resolve,
      reject: reject
    });
  });
};

PriorityQueue.prototype._tick = function () {
  while (this.numReadyWorkers && this.heap.len) {
    this.numReadyWorkers -= 1;
    this._processTask(this.heap.popMax().data);
  }
};

PriorityQueue.prototype._processTask = function (task) {
  var self = this;
  self.pool.apply.apply(self.pool, task.args)
    .then(task.resolve, task.reject)
    .finally(function () {
      self.numReadyWorkers += 1;
      self._tick();
    });
};

module.exports = PriorityQueue;
