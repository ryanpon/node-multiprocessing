'use strict';

var jsonUtils = require('./json-utils');

var jobFns = {};

function processData(data, index, jobId) {
  try {
    var fn = jobFns[jobId];
    var result = fn(jsonUtils.safeParse(data));
    process.send({
      jobId: jobId,
      index: index,
      result: jsonUtils.safeStringify(result)
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
  if (data.modulePath) {
    jobFns[data.jobId] = require(data.modulePath);
  }
  if (data.fnStr) {
    var fn;
    eval('fn =' + data.fnStr);  // eslint-disable-line
    jobFns[data.jobId] = fn;
  }
  if ('data' in data) {
    processData(data.data, data.index, data.jobId);
  }
});
