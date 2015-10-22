'use strict';

var Heap   = require('../')._Heap;
var chai   = require('chai');
var should = chai.should();
var _      = require('lodash');

describe('Heap', function () {

  it('should be a max heap', function () {
    var arr  = _.range(1000).map(_.random.bind(_, 0, 1000000, false));
    var heap = new Heap();
    arr.forEach(function (elem) {
      heap.insert(elem);
    });
    var arrFromHeap = [];
    while (heap.len) {
      arrFromHeap.push(heap.popMax().elem);
    }

    var sortedArr = _.sortBy(arr).reverse();
    arrFromHeap.should.eql(sortedArr);
  });

  it('should insert items with data', function () {
    var heap = new Heap();
    should.not.exist(heap.popMax());

    heap.insert(40, 'O');
    heap.insert(50, 'Hell');
    heap.insert(20, '!');
    heap.insert(30, 'World');

    heap.popMax().data.should.equal('Hell');
    heap.popMax().data.should.equal('O');
    heap.popMax().data.should.equal('World');
    heap.popMax().data.should.equal('!');
    should.not.exist(heap.popMax());
  });

});
