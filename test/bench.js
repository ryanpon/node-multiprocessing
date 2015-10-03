'use strict';  /* eslint-disable no-console */

var Pool = require('../').Pool;
var _    = require('lodash');

// Very basic bench for reference during changes
//   - pool map has about 300ms overhead on my i7 mac with chunksize 1
//   - pool map has about 100ms overhead on my i7 mac with default chunksize
var base = _.range(10000);
var fn = function (n) {
  return n;
};

console.time('builtin map');
base.map(fn);
console.timeEnd('builtin map');

console.time('createPool');
var pool = new Pool(6);
console.timeEnd('createPool');

console.time('pool map');
pool.map(base, fn)
  .then(function () {
    console.timeEnd('pool map');
    process.exit(0);
  })
  .catch(function (err) {
    console.log(err);
    console.log(err.stack);
    process.exit(1);
  });
