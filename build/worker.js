'use strict';

var jsonUtils = require('./json-utils');
var jobFns = {};
var isPromise = function isPromise(obj) {
  return obj && typeof obj.then === 'function';
};

function processData(argList, jobId, index) {
  function sendErr(err) {
    process.send({
      jobId: jobId,
      error: err.message,
      stack: err.stack
    });
  }
  function sendSucess(res, offset) {
    process.send({
      jobId: jobId,
      index: index + offset,
      result: jsonUtils.safeStringify(res),
      jobDone: offset === argList.length - 1
    });
  }
  function handlePromise(promise, offset) {
    return promise.then(function (res) {
      return sendSucess(res, offset);
    }, sendErr);
  }

  try {
    var fn = jobFns[jobId];
    argList.forEach(function (args, offset) {
      var res = fn(args);
      return isPromise(res) ? handlePromise(res, offset) : sendSucess(res, offset);
    });
  } catch (err) {
    return sendErr(err);
  }
}

process.on('message', function (data) {
  if (data.argList) {
    processData(jsonUtils.safeParse(data.argList), data.jobId, data.index);
  }
  if (data.deregisterJob) {
    delete jobFns[data.jobId];
    return;
  }
  if (data.modulePath) {
    jobFns[data.jobId] = require(data.modulePath);
  }
  if (data.fnStr) {
    var fn = void 0;
    eval('fn =' + data.fnStr); // eslint-disable-line
    jobFns[data.jobId] = fn;
  }
});
