'use strict';

var Pool   = require('./');
var should = require('chai').should();

describe('Pool', function () {

  it('should perform a simple map', function () {
    return new Pool(2).map([1, 2, 3], function (n) {
      return n;
    })
      .then(function (res) {
        should.exist(res);
        res.should.eql([1, 2, 3]);
      });
  });

});
