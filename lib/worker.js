'use strict';

var jsonUtils = require('./json-utils');

var jobFns = {};

function processData(argList, index, jobId) {
  try {
    var fn = jobFns[jobId];
    var resultList = jsonUtils.safeParse(argList).map(fn);
    process.send({
      jobId      : jobId,
      index      : index,
      resultList : jsonUtils.safeStringify(resultList)
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
    processData(data.argList, data.index, data.jobId);
  }
});
