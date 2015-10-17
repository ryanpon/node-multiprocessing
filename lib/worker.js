'use strict';

var jsonUtils = require('./json-utils');

var jobFns = {};

function processData(argList, index, jobId) {
  try {
    var fn = jobFns[jobId];
    argList.forEach(function (args, i) {
      process.send({
        jobId   : jobId,
        index   : index + i,
        result  : jsonUtils.safeStringify(fn(args)),
        jobDone : i === argList.length - 1
      });
    });
  } catch (err) {
    process.send({
      jobId: jobId,
      error: err.message,
      stack: err.stack
    });
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
