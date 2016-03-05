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

  try {
    var fn = jobFns[jobId];
    argList.forEach(function (args, offset) {
      if (fn.length === 1) {
        var res = fn(args);
        if (res && typeof res.then === 'function') {
          // promise exit
          return res.then(
            function (res) { sendSucess(res, offset); },
            function (err) { sendErr(err); }
          );
        }

        // sync exit
        return sendSucess(res, offset);
      }

      // callback exit
      return fn(args, function (err, res) {
        err ? sendErr(err) : sendSucess(res, offset);
      });
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
