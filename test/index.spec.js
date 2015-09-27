'use strict';

var Pool   = require('../').Pool;
var should = require('chai').should();

describe('Pool', function () {

  describe('#close', function () {

  });

  describe('#apply', function () {

  });

  describe('#map', function () {

    it('should perform a simple map', function () {
      return new Pool(2).map([1, 2, 3, 4, 5], function (n) {
        return n * 2;
      })
        .then(function (res) {
          should.exist(res);
          res.should.eql([2, 4, 6, 8, 10]);
        });
    });

    it('should handle errors', function () {
      var threwErr = false;
      return new Pool(2).map([1, 2, 3], function (n) {
        if (n === 2) {
          throw new Error('test error');
        }
        return n;
      })
        .catch(function (err) {
          threwErr = true;
          err.should.match(/test error/);
        })
        .finally(function () {
          threwErr.should.be.true;
        });
    });

    it('should work with more workers than items to process', function () {
      return new Pool(6).map([1, 2, 3], function (n) {
        return n * 4;
      })
        .then(function (res) {
          should.exist(res);
          res.should.eql([4, 8, 12]);
        });
    });

    it('should work with a single worker', function () {
      return new Pool(1).map([1, 2, 3], function (n) {
        return n * 4;
      })
        .then(function (res) {
          should.exist(res);
          res.should.eql([4, 8, 12]);
        });
    });

    it('should work with one item in array', function () {
      return new Pool(2).map([1], function (n) {
        return n * 4;
      })
        .then(function (res) {
          should.exist(res);
          res.should.eql([4]);
        });
    });

    it('should work with no items in array', function () {
      return new Pool(2).map([], function (n) {
        return n;
      })
        .then(function (res) {
          should.exist(res);
          res.should.eql([]);
        });
    });

    it('should throw an error if no worker function or module provided', function () {
      (function () {
        return new Pool(2).map([1], 123);
      }).should.throw(/fnOrModulePath must be a function or a string/);
    });

  });

});
