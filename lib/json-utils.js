'use strict'

const JS_DATE_REGEX = /^\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d.\d\d\dZ$/

const jsonUtils = module.exports = {
  reviver(key, value) {
    return typeof value === 'string' && JS_DATE_REGEX.test(value) ? new Date(value) : value
  },
  safeStringify(obj) {
    return typeof obj !== 'undefined' ? JSON.stringify(obj) : obj
  },
  safeParse(str) {
    return typeof str !== 'undefined' ? JSON.parse(str, jsonUtils.reviver) : str
  }
}
