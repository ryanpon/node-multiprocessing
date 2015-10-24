'use strict';

function newHeapNode(elem, data, subheaps) {
  return {
    elem: elem,
    data: data,
    subheaps: subheaps
  };
}

function Heap() {
  this.root = null;
  this.len = 0;
}

Heap.prototype.popMax = function () {
  if (!this.len) {
    return null;
  }
  var min = this.root;
  this.len -= 1;
  this.root = this.mergePairs(this.root.subheaps);
  return min;
};

Heap.prototype.insert = function (elem, data) {
  this.root = this.merge(this.root, newHeapNode(elem, data, []));
  return ++this.len;
};

Heap.prototype.merge = function (heap1, heap2) {
  if (!heap1 || !heap2) {
    return heap1 || heap2;
  }

  if (heap1.elem > heap2.elem) {
    heap1.subheaps.push(heap2);
    return heap1;
  }

  heap2.subheaps.push(heap1);
  return heap2;
};

Heap.prototype.mergePairs = function (heaps) {
  var paired = [];
  while (heaps.length > 1) {
    var heap1 = heaps.pop();
    var heap2 = heaps.pop();
    if (heap1.elem > heap2.elem) {
      heap1.subheaps.push(heap2);
      paired.push(heap1);
    } else {
      heap2.subheaps.push(heap1);
      paired.push(heap2);
    }
  }
  if (heaps.length) {
    paired.push(heaps.pop());
  }

  var newRoot = paired.pop();
  while (paired.length) {
    var heap = paired.pop();
    if (heap.elem > newRoot.elem) {
      heap.subheaps.push(newRoot);
      newRoot = heap;
    } else {
      newRoot.subheaps.push(heap);
    }
  }

  return newRoot;
};

module.exports = Heap;
