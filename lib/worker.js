'use strict'

const jsonUtils = require('./json-utils')
const jobFns = {}

function processData(argList, jobId, index) {
  function sendErr(err) {
    process.send({
      jobId: jobId,
      error: err.message,
      stack: err.stack
    })
  }
  function sendSucess(res, offset) {
    process.send({
      jobId   : jobId,
      index   : index + offset,
      result  : jsonUtils.safeStringify(res),
      jobDone : offset === argList.length - 1
    })
  }
  function handlePromise(promise, offset) {
    return promise.then(res => sendSucess(res, offset), sendErr)
  }

  try {
    const fn = jobFns[jobId]
    argList.forEach((args, offset) => {
      const res = fn(args)
      return res && typeof res.then === 'function' ?
        handlePromise(res, offset) :
        sendSucess(res, offset)
    })
  } catch (err) {
    return sendErr(err)
  }
}

process.on('message', data => {
  if (data.argList) {
    processData(jsonUtils.safeParse(data.argList), data.jobId, data.index)
  }
  if (data.deregisterJob) {
    delete jobFns[data.jobId]
    return
  }
  if (data.modulePath) {
    jobFns[data.jobId] = require(data.modulePath)
  }
  if (data.fnStr) {
    let fn
    eval('fn =' + data.fnStr)  // eslint-disable-line
    jobFns[data.jobId] = fn
  }
})
