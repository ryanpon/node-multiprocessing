'use strict'

const fork      = require('child_process').fork
const jsonUtils = require('./json-utils')

const allWorkers = []
process.on('exit', () => allWorkers.forEach(worker => worker.process.kill()))

function makeError(errorMsg, stack) {
  const err = new Error(errorMsg)
  err.stack = stack
  return err
}

module.exports = class WorkerWrapper {

  constructor() {
    this.process = null
    this.runningJobs = 0
    this.terminated = false
    this.registeredJobs = {}
    this.fnOrModulePaths = {}
    this.timeout = null

    this.startWorkerProcess()
    allWorkers.push(this)
  }

  startWorkerProcess() {
    this.process = fork(`${__dirname}/worker.js`)
    for (const regJobId in this.registeredJobs) {
      if (this.registeredJobs.hasOwnProperty(regJobId)) {
        const job = this.registeredJobs[regJobId]
        this.registerJob(regJobId, job.fnOrModulePath, job.callback)
      }
    }
    this.process.on('message', data => {
      const job = this.registeredJobs[data.jobId]
      if (job.terminated) { return }

      clearTimeout(this.timeout)
      let err = null
      if (data.error) {
        err = makeError(data.error, data.stack)
      }
      job.callback(err, data)
      if (data.jobDone) {
        this.runningJobs -= 1
      } else if (job.timeout > 0) {
        this.startJobTimeout(job)
      }
      if (this.terminated && this.runningJobs === 0) {
        this.process.disconnect()
      }
    })
  }

  runJob(jobId, index, argList) {
    if (this.terminated) { return }  // TODO: should this be an error?

    this.process.send({
      jobId   : jobId,
      index   : index,
      argList : jsonUtils.safeStringify(argList)
    })
    this.runningJobs += 1

    const job = this.registeredJobs[jobId]
    if (job.timeout > 0) {
      this.startJobTimeout(job)
    }
  }

  registerJob(jobId, fnOrModulePath, options, callback) {
    const timeout = (options ? options.timeout : null) || -1

    if (this.terminated) { return }  // TODO: should this be an error?

    this.registeredJobs[jobId] = {callback, fnOrModulePath, timeout, options}
    const modulePath = typeof fnOrModulePath === 'string' ? fnOrModulePath : null
    const fnStr = typeof fnOrModulePath === 'function' ? fnOrModulePath.toString() : null
    this.process.send({
      jobId      : jobId,
      modulePath : modulePath,
      fnStr      : fnStr
    })
  }

  deregisterJob(jobId) {
    if (this.terminated) { return }  // TODO: should this be an error?

    delete this.registeredJobs[jobId]
    this.process.send({
      jobId         : jobId,
      deregisterJob : true
    })
  }

  terminateImmediately() {
    this.terminated = true
    this.process.disconnect()
    for (const cbName in this.registeredJobs) {
      if (this.registeredJobs.hasOwnProperty(cbName)) {
        this.registeredJobs[cbName].callback(new Error('Pool was closed'), null)
      }
    }
  }

  terminateAfterJobsComplete() {
    this.terminated = true
    if (this.runningJobs === 0) {
      this.process.disconnect()
    }
  }

  startJobTimeout(job) {
    this.timeout = setTimeout(() => {
      job.terminated = true
      this.process.kill()
      this.startWorkerProcess()
      job.callback(new Error('Task timed out'), null)
    }, job.timeout)
  }

}
