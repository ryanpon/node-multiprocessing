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
  function sendResult(result, offset) {
    process.send({
      jobId   : jobId,
      index   : index + offset,
      result  : jsonUtils.safeStringify(result),
      jobDone : offset === argList.length - 1
    });
  }

  try {
    var fn = jobFns[jobId];
    argList.forEach(function (args, offset) {
      return sendResult(fn(args), offset);
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
