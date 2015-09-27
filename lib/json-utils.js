'use strict';

var jsonUtils = module.exports = {
  reviver: function (key, value) {
    if (typeof value === 'string') {
      var regexp;
      regexp = /^\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d.\d\d\dZ$/.exec(value);
      if (regexp) {
        return new Date(value);
      }
    }
    return value;
  },
  safeStringify: function (obj) {
    return typeof obj !== 'undefined' ? JSON.stringify(obj) : obj;
  },
  safeParse: function (str) {
    return typeof str !== 'undefined' ? JSON.parse(str, jsonUtils.reviver) : str;
  }
};
