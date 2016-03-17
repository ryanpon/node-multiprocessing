'use strict';

var JS_DATE_REGEX = /^\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d.\d\d\dZ$/;

var jsonUtils = module.exports = {
  reviver: function (key, value) {
    return typeof value === 'string' && JS_DATE_REGEX.test(value) ? new Date(value) : value;
  },
  safeStringify: function (obj) {
    return typeof obj !== 'undefined' ? JSON.stringify(obj) : obj;
  },
  safeParse: function (str) {
    return typeof str !== 'undefined' ? JSON.parse(str, jsonUtils.reviver) : str;
  }
};
