'use strict';

var jsonUtils = require('./json-utils');

function processData(data, index, fn) {
  try {
    var result = fn(jsonUtils.safeParse(data));
    process.send({
      index: index,
      result: jsonUtils.safeStringify(result)
    });
  } catch (err) {
    process.send({
      error: err.message,
      stack: err.stack
    });
  }
}

var fn;
process.on('message', function (data) {
  if (data.modulePath) {
    fn = require(data.modulePath);
  }
  if (data.fnStr) {
    eval('fn = ' + data.fnStr);  // eslint-disable-line
  }
  if ('data' in data) {
    processData(data.data, data.index, fn);
  }
});
