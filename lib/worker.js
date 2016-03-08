'use strict';

var jsonUtils = require('./json-utils');

var jobFns = {};

function processData(argList, index, jobId) {
  function sendErr(err) {
    process.send({
      jobId: jobId,
      error: err.message,
      stack: err.stack
    });
  }
  function sendSucess(res, offset) {
    process.send({
      jobId   : jobId,
      index   : index + offset,
      result  : jsonUtils.safeStringify(res),
      jobDone : offset === argList.length - 1
    });
  }
  function handlePromise(promise, offset) {
    return promise.then(
      function (res) { sendSucess(res, offset); },
      function (err) { sendErr(err); }
    );
  }

  try {
    var fn = jobFns[jobId];
    argList.forEach(function (args, i) {
      var res = fn(args);
      return res && typeof res.then === 'function' ?
        handlePromise(res, i) :
        sendSucess(res, i);
    });
  } catch (err) {
    return sendErr(err);
  }
}

process.on('message', function (data) {
  if (data.deregisterJob) {
    delete jobFns[data.jobId];
    return;
  }
  if (data.modulePath) {
    jobFns[data.jobId] = require(data.modulePath);
  }
  if (data.fnStr) {
    var fn;
    eval('fn =' + data.fnStr);  // eslint-disable-line
    jobFns[data.jobId] = fn;
  }
  if ('argList' in data) {
    processData(jsonUtils.safeParse(data.argList), data.index, data.jobId);
  }
});
