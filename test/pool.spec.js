'use strict'

const Pool   = require('../').Pool
const chai   = require('chai')
const should = chai.should()
const _      = require('lodash')
const P      = require('bluebird')
const os     = require('os')

chai.use(require('chai-as-promised'))

describe('Pool', function () {

  describe('constructor', function () {

    it('should adhere to the number of workers passed in', function () {
      const pool = new Pool(4)
      pool.workers.should.have.length(4)
    })

    it('should default to number of CPUs on the machine num workers is not passed', function () {
      const pool = new Pool()
      pool.workers.should.have.length(os.cpus().length)
    })

  })

  describe('#close', function () {

    it('should stop child processes', function () {
      const pool = new Pool(4)
      pool.close()
      return pool.map([1, 2, 3, 4, 5], function (n) {
        return n * 2
      }, {chunksize: 2})
        .catch(function (err) {
          pool.workers.forEach(function (worker) {
            worker.process.connected.should.be.false
          })
          throw err
        })
        .should.be.rejectedWith(/Pool has been closed/)
    })

    it('should not interrupt running jobs', function () {
      const pool = new Pool(4)
      const job = pool.map([1, 2, 3], function (n) {
        return n * 2
      })
      pool.close()

      return job
        .then(function (result) {
          result.should.eql([2, 4, 6])
        })
        .then(function () {
          pool.workers.forEach(function (worker) {
            worker.process.connected.should.be.false
          })
        })
    })

  })

  describe('#terminate', function () {

    it('should stop child processes', function () {
      const pool = new Pool(4)
      pool.terminate()
      return pool.map([1, 2, 3, 4, 5], function (n) {
        return n * 2
      })
        .catch(function (err) {
          pool.workers.forEach(function (worker) {
            worker.process.connected.should.be.false
          })
          throw err
        })
        .should.be.rejectedWith(/Pool has been closed/)
    })

    it('should interrupt running jobs', function () {
      const pool = new Pool(4)
      const job = pool.map([1, 2, 3], function (n) {
        return n * 2
      })
      pool.terminate()

      return job
        .then(function () {
          throw new Error('Should not reach here')
        }, function (err) {
          err.should.match(/Pool was closed/)
        })
        .then(function () {
          pool.workers.forEach(function (worker) {
            worker.process.connected.should.be.false
          })
        })
    })

  })

  describe('#map', function () {

    it('should perform a simple map', function () {
      return new Pool(2).map([1, 2, 3, 4, 5], function (n) {
        return n * 2
      })
        .then(function (res) {
          should.exist(res)
          res.should.eql([2, 4, 6, 8, 10])
        })
    })

    it('should perform multiple maps at once', function () {
      const pool = new Pool(2)
      const arr1 = _.range(0, 50)
      const fn1 = function (n) {
        return n * 5
      }
      const arr2 = _.range(25, 750)
      const fn2 = function (n) {
        return n * 2
      }
      const arr3 = _.range(1, 4)
      const fn3 = function (n) {
        return n
      }
      return P.all([
        pool.map(arr1, fn1),
        pool.map(arr2, fn2),
        pool.map(arr3, fn3)
      ])
        .spread(function (res1, res2, res3) {
          res1.should.eql(arr1.map(fn1))
          res2.should.eql(arr2.map(fn2))
          res3.should.eql(arr3.map(fn3))
        })
    })

    it('should handle errors', function () {
      return new Pool(2).map([1, 2, 3], function (n) {
        if (n === 2) {
          throw new Error('test error')
        }
        return n
      })
        .should.be.rejectedWith(/test error/)
    })

    it('should work with more workers than items to process', function () {
      return new Pool(6).map([1, 2, 3], function (n) {
        return n * 4
      })
        .then(function (res) {
          should.exist(res)
          res.should.eql([4, 8, 12])
        })
    })

    it('should work with a single worker', function () {
      return new Pool(1).map([1, 2, 3], function (n) {
        return n * 4
      })
        .then(function (res) {
          should.exist(res)
          res.should.eql([4, 8, 12])
        })
    })

    it('should work with one item in array', function () {
      return new Pool(2).map([1], function (n) {
        return n * 4
      })
        .then(function (res) {
          should.exist(res)
          res.should.eql([4])
        })
    })

    it('should work with no items in array', function () {
      return new Pool(2).map([], function (n) {
        return n
      })
        .then(function (res) {
          should.exist(res)
          res.should.eql([])
        })
    })

    it('should throw an error if no worker function or module provided', function () {
      return new Pool(2).map([1], 123)
        .should.be.rejectedWith(/fnOrModulePath must be a function or a string/)
    })

    it('should still work after processing multiple jobs', function () {
      const pool = new Pool(2)
      const fn = function (n) { return n * 5 }
      return P.all([
        pool.map(_.range(50), fn),
        pool.map(_.range(75), fn),
        pool.map(_.range(100), fn)
      ])
        .then(function () {
          pool.map(_.range(50), fn)
          return pool.map([5, 7, 1], fn)
        })
        .then(function (result) {
          result.should.eql([25, 35, 5])
        })
    })

    it('should work with chunksize larger than job', function () {
      const pool = new Pool(2)
      const fn = function (n) { return n * 2 }
      return pool.map([5, 7, 1], fn, 100)
        .then(function (result) {
          result.should.eql([10, 14, 2])
        })
    })

    it('should work with a module name', function () {
      const pool = new Pool(2)
      return pool.map(['Ryan', 'World'], `${__dirname}/sample-module`)
        .then(function (result) {
          should.exist(result)
          result.should.eql(['Hello, Ryan!', 'Hello, World!'])
        })
    })

    it('should call a callback function on each result', function ()  {
      const pool = new Pool(2)
      const callbacks = []
      const onResult = (result, index) => {
        callbacks.push([result, index])
        callbacks.sort()
      }
      return pool.map([1, 2], x => x, {onResult})
        .then(function (result) {
          callbacks.should.eql([
            [1, 0],
            [2, 1]
          ])
        })
    })

  })

  describe('#apply', function () {

    it('should be a convenience method for running map with a single argument', function () {
      return new Pool(2).apply(5, function (n) {
        return n * 10
      })
        .then(function (res) {
          should.exist(res)
          res.should.equal(50)
        })
    })

    it('should be able to handle simultaneous calls', function () {
      const fn = function (n) {
        return n * 10
      }
      const pool = new Pool(4)
      return P.all([
        pool.apply(1, fn),
        pool.apply(2, fn),
        pool.apply(3, fn),
        pool.apply(4, fn),
        pool.apply(5, fn),
        pool.map([6], fn)
      ])
        .then(function (results) {
          results.should.eql([10, 20, 30, 40, 50, [60]])
        })
    })

    it('should work with a module name', function () {
      const pool = new Pool(2)
      return pool.apply('World', `${__dirname}/sample-module`)
        .then(function (result) {
          should.exist(result)
          result.should.equal('Hello, World!')
        })
    })

    it('should be able to handle P based functions', function () {
      const fn = function (n) {
        return require('bluebird').resolve(n * 4).delay(10)
      }
      const pool = new Pool(2)
      return P.all([
        pool.apply(4, fn),
        pool.apply(1, fn),
        pool.apply(3, fn),
        pool.apply(2, fn)
      ])
        .then(function (results) {
          results.should.eql([16, 4, 12, 8])
        })
    })

    it('should handle P rejections', function () {
      const fn = function (n) {
        const P = require('bluebird')
        if (n === 1) {
          return P.reject(new Error('My unlucky number'))
        }
        return require('bluebird').resolve(n * 4).delay(10)
      }
      const pool = new Pool(3)
      return P.all([
        pool.apply(4, fn),
        pool.apply(1, fn),
        pool.apply(3, fn),
        pool.apply(2, fn)
      ])
        .should.be.rejectedWith('My unlucky number')
    })

    it('should handle P and non-P workers', function () {
      const fn1 = function (n) {
        return n * 20
      }
      const fn2 = function (n) {
        const P = require('bluebird')
        return P.resolve(n * 2)
      }
      const pool = new Pool(4)
      return P.all([
        pool.apply(2, fn2),
        pool.apply(1, fn1),
        pool.apply(3, fn1),
        pool.map([4, 8], fn2),
        pool.map([4, 8, 10], fn1)
      ])
        .then(function (results) {
          results.should.eql([4, 20, 60, [8, 16], [80, 160, 200]])
        })
    })

  })

  describe('#define', function () {

    it('should fail when registering a name that already exists', function () {
      const pool = new Pool(5)
      pool.define('greet', `${__dirname}/sample-module`)
      ;(function () {
        pool.define('greet', `${__dirname}/sample-module`)
      }).should.throw('Pool already has a property "greet"')
    })

    it('should provide a simple wrapper over apply', function () {
      const pool = new Pool(5)
      pool.define('square', x => x * x)
      return pool.square.apply(5)
        .then(function (res) {
          res.should.equal(25)
        })
    })

    it('should provide a simple wrapper over map', function () {
      const pool = new Pool(5)
      pool.define('square', x => x * x)
      return pool.square.map([5, 2, 3])
        .then(function (res) {
          res.should.eql([25, 4, 9])
        })
    })

    it('should work with modules', function () {
      const pool = new Pool(5)
      pool.define('greet', `${__dirname}/sample-module`)
      return P.join(pool.greet.apply('World!!'), pool.greet.apply('Earth!!'))
        .spread(function (res1, res2) {
          res1.should.equal('Hello, World!!!')
          res2.should.equal('Hello, Earth!!!')
        })
    })

  })

  describe('Queue behavior', function () {

    it('should process multiple jobs sequentially for chunksizes of 1', function () {
      const pool = new Pool(5)
      let jobsCompleted = 0
      const fn = function (n) { return n }
      return P.all([
        pool.map(_.range(501), fn, 1)
          .then(function () {
            jobsCompleted++
            jobsCompleted.should.equal(1)
          }),
        pool.map(_.range(502), fn, 1)
          .then(function () {
            jobsCompleted++
            jobsCompleted.should.equal(2)
          }),
        pool.map(_.range(503), fn, 1)
          .then(function () {
            jobsCompleted++
            jobsCompleted.should.equal(3)
          })
      ])
    })

    // TODO: need a better way to test this
    it.skip('should utilize all workers at once', function () {
      const pool = new Pool(3)
      let jobsCompleted = 0
      const fn = function (n) { return n }
      return P.all([
        pool.map(_.range(1000), fn, 500)
          .then(function () {
            jobsCompleted++
            jobsCompleted.should.equal(2)
          }),
        pool.map(_.range(1), fn, 1)
          .then(function () {
            jobsCompleted++
            jobsCompleted.should.equal(1)
          })
      ])
    })

  })

  describe('Timeouts', function () {

    it('should terminate a job if the task does not return within given timeout', function () {
      const pool = new Pool(1)
      const fn = function (n) {
        while (n === 2) {
          continue
        }
        return n
      }

      return pool.map([1, 2, 3, 4, 5], fn, {
        timeout: 250
      })
        .should.be.rejectedWith(/Task timed out/)
        .then(function () {
          return pool.map([1, 2, 3, 4, 5], function (n) {
            return n
          })
        })
        .then(function (res) {
          res.should.eql([1, 2, 3, 4, 5])
        })
    })

    it('should not terminate jobs that do not time out', function () {
      const pool = new Pool(3)
      const fn = function (n) {
        return n
      }

      return pool.map([1, 2, 3, 4, 5], fn, {
        timeout: 250
      })
    })

  })

})
