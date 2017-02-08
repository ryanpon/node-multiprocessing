'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Pool = require('./pool');
var Heap = require('./heap');
var P = require('bluebird');

module.exports = function () {
  function PriorityQueue(numWorkers) {
    _classCallCheck(this, PriorityQueue);

    this.numReadyWorkers = numWorkers;
    this.pool = new Pool(numWorkers);
    this.heap = new Heap();
  }

  _createClass(PriorityQueue, [{
    key: 'push',
    value: function push(arg, priority, fnOrModulePath, options) {
      var _this = this;

      return new P(function (resolve, reject) {
        _this.heap.insert(priority, {
          args: [arg, fnOrModulePath, options],
          resolve: resolve,
          reject: reject
        });
        _this._tick();
      });
    }
  }, {
    key: '_tick',
    value: function _tick() {
      while (this.numReadyWorkers && this.heap.len) {
        this.numReadyWorkers -= 1;
        this._processTask(this.heap.popMax().data);
      }
    }
  }, {
    key: '_processTask',
    value: function _processTask(task) {
      var _pool,
          _this2 = this;

      (_pool = this.pool).apply.apply(_pool, _toConsumableArray(task.args)).then(task.resolve, task.reject).then(function () {
        _this2.numReadyWorkers += 1;
        _this2._tick();
      });
    }
  }]);

  return PriorityQueue;
}();