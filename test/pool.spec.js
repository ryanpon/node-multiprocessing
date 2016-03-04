'use strict';

var Pool   = require('../').Pool;
var chai   = require('chai');
var should = chai.should();
var P      = require('bluebird');
var _      = require('lodash');

chai.use(require('chai-as-promised'));

describe('Pool', function () {

  describe('#close', function () {

    it('should stop child processes', function () {
      var pool = new Pool(4);
      pool.close();
      return pool.map([1, 2, 3, 4, 5], function (n) {
        return n * 2;
      }, {chunksize: 2})
        .catch(function (err) {
          pool.workers.forEach(function (worker) {
            worker.process.connected.should.be.false;
          });
          throw err;
        })
        .should.be.rejectedWith(/Pool has been closed/);
    });

    it('should not interrupt running jobs', function () {
      var pool = new Pool(4);
      var job = pool.map([1, 2, 3], function (n) {
        return n * 2;
      });
      pool.close();

      return job
        .then(function (result) {
          result.should.eql([2, 4, 6]);
        })
        .then(function () {
          pool.workers.forEach(function (worker) {
            worker.process.connected.should.be.false;
          });
        });
    });

  });

  describe('#terminate', function () {

    it('should stop child processes', function () {
      var pool = new Pool(4);
      pool.terminate();
      return pool.map([1, 2, 3, 4, 5], function (n) {
        return n * 2;
      })
        .catch(function (err) {
          pool.workers.forEach(function (worker) {
            worker.process.connected.should.be.false;
          });
          throw err;
        })
        .should.be.rejectedWith(/Pool has been closed/);
    });

    it('should interrupt running jobs', function () {
      var pool = new Pool(4);
      var job = pool.map([1, 2, 3], function (n) {
        return n * 2;
      });
      pool.terminate();

      return job
        .then(function () {
          throw new Error('Should not reach here');
        }, function (err) {
          err.should.match(/Pool was closed/);
        })
        .then(function () {
          pool.workers.forEach(function (worker) {
            worker.process.connected.should.be.false;
          });
        });
    });

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

    it('should perform multiple maps at once', function () {
      var pool = new Pool(2);
      var arr1 = _.range(0, 50);
      var fn1 = function (n) {
        return n * 5;
      };
      var arr2 = _.range(25, 750);
      var fn2 = function (n) {
        return n * 2;
      };
      var arr3 = _.range(1, 4);
      var fn3 = function (n) {
        return n;
      };
      return P.all([
        pool.map(arr1, fn1),
        pool.map(arr2, fn2),
        pool.map(arr3, fn3)
      ])
        .spread(function (res1, res2, res3) {
          res1.should.eql(arr1.map(fn1));
          res2.should.eql(arr2.map(fn2));
          res3.should.eql(arr3.map(fn3));
        });
    });

    it('should handle errors', function () {
      return new Pool(2).map([1, 2, 3], function (n) {
        if (n === 2) {
          throw new Error('test error');
        }
        return n;
      })
        .should.be.rejectedWith(/test error/);
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
      return new Pool(2).map([1], 123)
        .should.be.rejectedWith(/fnOrModulePath must be a function or a string/);
    });

    it('should still work after processing multiple jobs', function () {
      var pool = new Pool(2);
      var fn = function (n) { return n * 5; };
      return P.all([
        pool.map(_.range(50), fn),
        pool.map(_.range(75), fn),
        pool.map(_.range(100), fn)
      ])
        .then(function () {
          pool.map(_.range(50), fn);
          return pool.map([5, 7, 1], fn);
        })
        .then(function (result) {
          result.should.eql([25, 35, 5]);
        });
    });

    it('should work with chunksize larger than job', function () {
      var pool = new Pool(2);
      var fn = function (n) { return n * 2; };
      return pool.map([5, 7, 1], fn, 100)
        .then(function (result) {
          result.should.eql([10, 14, 2]);
        });
    });

    it('should work with a module name', function () {
      var pool = new Pool(2);
      return pool.map(['Ryan', 'World'], __dirname + '/sample-module')
        .then(function (result) {
          should.exist(result);
          result.should.eql(['Hello, Ryan!', 'Hello, World!']);
        });
    });

  });

  describe('#apply', function () {

    it('should be a convenience method for running map with a single argument', function () {
      return new Pool(2).apply(5, function (n) {
        return n * 10;
      })
        .then(function (res) {
          should.exist(res);
          res.should.equal(50);
        });
    });

    it('should be able to handle simultaneous calls', function () {
      var fn = function (n) {
        return n * 10;
      };
      var pool = new Pool(4);
      return P.all([
        pool.apply(1, fn),
        pool.apply(2, fn),
        pool.apply(3, fn),
        pool.apply(4, fn),
        pool.apply(5, fn),
        pool.map([6], fn)
      ])
        .then(function (results) {
          results.should.eql([10, 20, 30, 40, 50, [60]]);
        });
    });

    it('should work with a module name', function () {
      var pool = new Pool(2);
      return pool.apply('World', __dirname + '/sample-module')
        .then(function (result) {
          should.exist(result);
          result.should.equal('Hello, World!');
        });
    });

    it('should be able to handle callback based functions', function () {
      var fn = function (n, cb) {
        cb(null, n * 15);
      };
      var pool = new Pool(4);
      return P.all([
        pool.apply(1, fn),
        pool.apply(2, fn)
      ])
        .then(function (results) {
          results.should.eql([15, 30]);
        });
    });

    it('should handle callback and non-callback based functions', function () {
      var fn = function (n, cb) {
        cb(null, n * 15);
      };
      var fn2 = function (n) {
        return n * 20;
      };
      var pool = new Pool(4);
      return P.all([
        pool.apply(1, fn),
        pool.apply(2, fn2),
        pool.apply(3, fn),
        pool.map([4, 8], fn2)
      ])
        .then(function (results) {
          results.should.eql([15, 40, 45, [80, 160]]);
        });
    });

  });

  describe('Queue behavior', function () {

    it('should process multiple jobs sequentially for chunksizes of 1', function () {
      var pool = new Pool(5);
      var jobsCompleted = 0;
      var fn = function (n) { return n; };
      return P.all([
        pool.map(_.range(501), fn, 1)
          .then(function () {
            jobsCompleted++;
            jobsCompleted.should.equal(1);
          }),
        pool.map(_.range(502), fn, 1)
          .then(function () {
            jobsCompleted++;
            jobsCompleted.should.equal(2);
          }),
        pool.map(_.range(503), fn, 1)
          .then(function () {
            jobsCompleted++;
            jobsCompleted.should.equal(3);
          })
      ]);
    });

    // TODO: need a better way to test this
    it.skip('should utilize all workers at once', function () {
      var pool = new Pool(3);
      var jobsCompleted = 0;
      var fn = function (n) { return n; };
      return P.all([
        pool.map(_.range(1000), fn, 500)
          .then(function () {
            jobsCompleted++;
            jobsCompleted.should.equal(2);
          }),
        pool.map(_.range(1), fn, 1)
          .then(function () {
            jobsCompleted++;
            jobsCompleted.should.equal(1);
          })
      ]);
    });

  });

  describe('Timeouts', function () {

    it('should terminate a job if the task does not return within given timeout', function () {
      var pool = new Pool(1);
      var fn = function (n) {
        while (n === 2) {
          continue;
        }
        return n;
      };

      return pool.map([1, 2, 3, 4, 5], fn, {
        timeout: 250
      })
        .should.be.rejectedWith(/Task timed out/)
        .then(function () {
          return pool.map([1, 2, 3, 4, 5], function (n) {
            return n;
          });
        })
        .then(function (res) {
          res.should.eql([1, 2, 3, 4, 5]);
        });
    });

    it('should not terminate jobs that do not time out', function () {
      var pool = new Pool(3);
      var fn = function (n) {
        return n;
      };

      return pool.map([1, 2, 3, 4, 5], fn, {
        timeout: 250
      });
    });

  });

});
