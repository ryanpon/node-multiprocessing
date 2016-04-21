'use strict'

const jsonUtils     = require('./json-utils')
const WorkerWrapper = require('./worker-wrapper')
const P             = require('bluebird')
const os            = require('os')

module.exports = class Pool {

  constructor(numWorkers) {
    this.queue = []
    this.closed = false
    this.workers = []
    numWorkers = numWorkers || os.cpus().length
    for (let i = 0; i < numWorkers; i++) {
      this.workers.push(new WorkerWrapper())
    }
    this.readyWorkers = this.workers.slice()
    this._nextJobId = 0
  }

  // Prevents any more tasks from being submitted to the pool.
  // Once all the tasks have been completed the worker processes will exit.
  close() {
    this.closed = true
    this.workers.forEach(worker => worker.terminateAfterJobsComplete())
  }

  // Stops the worker processes immediately without completing outstanding work.
  terminate() {
    this.closed = true
    this.workers.forEach(worker => worker.terminateImmediately())
  }

  define(name, fnOrModulePath, options) {
    if (this.hasOwnProperty(name)) {
      throw new Error(`Pool already has a property "${name}"`)
    }
    this[name] = {
      map: arg => this.map(arg, fnOrModulePath, options),
      apply: arg => this.apply(arg, fnOrModulePath, options)
    }
  }

  // Applies single argument to a function and returns result via a Promise
  apply(arg, fnOrModulePath, options) {
    return this.map([arg], fnOrModulePath, options)
      .then(result => result[0])
  }

  map(arr, fnOrModulePath, options) {
    return new P((resolve, reject) =>
      this._queuePush(arr, fnOrModulePath, options,
        (err, data) => err ? reject(err) : resolve(data))
    )
  }

  _queuePush(arr, fnOrModulePath, options, cb) {
    options = options || {}
    const chunksize = typeof options === 'number' ? options : options.chunksize

    if (this.closed) {
      return cb(new Error('Pool has been closed'), null)
    }
    this._assertIsUsableFnOrModulePath(fnOrModulePath)
    if (!arr || !arr.length) {
      return cb(null, [])
    }

    const job = {
      id: this._getNextJobId(),
      arr: arr,
      fnOrModulePath: fnOrModulePath,
      chunksize: chunksize || Math.ceil(arr.length / this.workers.length),
      cb: cb,
      nextIndex: 0,
      options: options
    }
    this._registerJobWithWorkers(job)
    this.queue.push(job)
    this._queueTick()
  }

  _queueTick() {
    while (this.queue.length && this.readyWorkers.length) {
      const job = this.queue[0]
      const chunk = job.arr.slice(job.nextIndex, job.nextIndex + job.chunksize)
      this.readyWorkers.pop().runJob(job.id, job.nextIndex, chunk)
      job.nextIndex += job.chunksize
      if (job.nextIndex >= job.arr.length) {
        this.queue.shift()
      }
    }
  }

  _registerJobWithWorkers(job) {
    const result = []
    let tasksRemaining = job.arr.length
    let jobTerminated = false
    this.workers.forEach(worker => {
      worker.registerJob(job.id, job.fnOrModulePath, job.options, (err, data) => {
        this.readyWorkers.push(worker)
        this._queueTick()

        if (jobTerminated) {
          return worker.deregisterJob(job.id)
        }

        if (err) {
          worker.deregisterJob(job.id)
          jobTerminated = true
          return job.cb(err, null)
        }

        result[data.index] = jsonUtils.safeParse(data.result)
        tasksRemaining -= 1
        if (tasksRemaining <= 0) {
          worker.deregisterJob(job.id)
          return job.cb(null, result)
        }
      })
    })
  }

  _assertIsUsableFnOrModulePath(fnOrModulePath) {
    if (typeof fnOrModulePath !== 'function' && typeof fnOrModulePath !== 'string') {
      throw new Error('fnOrModulePath must be a function or a string')
    }
  }

  _getNextJobId() {
    return this._nextJobId++
  }

}
