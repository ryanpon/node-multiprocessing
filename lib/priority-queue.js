'use strict'

const Pool = require('./pool')
const Heap = require('./heap')
const P    = require('bluebird')

module.exports = class PriorityQueue {

  constructor(numWorkers) {
    this.numReadyWorkers = numWorkers
    this.pool = new Pool(numWorkers)
    this.heap = new Heap()
  }

  push(arg, priority, fnOrModulePath, options) {
    return new P((resolve, reject) => {
      this.heap.insert(priority, {
        args: [arg, fnOrModulePath, options],
        resolve: resolve,
        reject: reject
      })
      this._tick()
    })
  }

  _tick() {
    while (this.numReadyWorkers && this.heap.len) {
      this.numReadyWorkers -= 1
      this._processTask(this.heap.popMax().data)
    }
  }

  _processTask(task) {
    this.pool.apply(...task.args)
      .then(task.resolve, task.reject)
      .then(() => {
        this.numReadyWorkers += 1
        this._tick()
      })
  }

}
