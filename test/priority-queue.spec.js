'use strict';

var PriorityQueue = require('../').PriorityQueue;
var chai          = require('chai');
var should        = chai.should();
var P             = require('bluebird');

chai.use(require('chai-as-promised'));

describe('Priority Queue', function () {

  it('should process items', function () {
    var pq = new PriorityQueue(2);
    var fn = function (n) { return n * 2; };

    return P.all([
      pq.push(1, 10, fn),
      pq.push(2, 20, fn),
      pq.push(3, 10, fn)
    ])
      .spread(function (res1, res2, res3) {
        should.exist(res1);
        should.exist(res2);
        should.exist(res3);

        res1.should.equal(2);
        res2.should.equal(4);
        res3.should.equal(6);
      });
  });

  it('should process items in order with only 1 worker', function () {
    var pq = new PriorityQueue(1);
    var fn = function (n) { return n; };
    var res = [];
    return P.all([
      pq.push(1, 10, fn).then(res.push.bind(res)),
      pq.push(3, 30, fn).then(res.push.bind(res)),
      pq.push(7, 70, fn).then(res.push.bind(res)),
      pq.push(2, 20, fn).then(res.push.bind(res)),
      pq.push(4, 40, fn).then(res.push.bind(res)),
      pq.push(6, 60, fn).then(res.push.bind(res)),
      pq.push(5, 50, fn).then(res.push.bind(res)),
      pq.push(8, 80, fn).then(res.push.bind(res))
    ])
      .then(function () {
        // task 1 gets kicked off before the others start, so it should show up
        // first even with the lowest priority
        res.should.eql([1, 8, 7, 6, 5, 4, 3, 2]);
      });
  });

});
