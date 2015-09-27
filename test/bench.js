'use strict';  /* eslint-disable no-console */

var Pool = require('../').Pool;
var _    = require('lodash');

// pool map has about 300ms overhead on my i7 mac
var base = _.range(10000);

console.time('builtin map');
base.map(function (i) {
  return i;
});
console.timeEnd('builtin map');

console.time('createPool');
var pool = new Pool(6);
console.timeEnd('createPool');

console.time('pool map');
pool.map(base, function (i) {
  return i;
})
.then(function () {
  console.timeEnd('pool map');

  process.exit(0);
})
.catch(function (err) {
  console.log(err);
  console.log(err.stack);
  process.exit(1);
});
