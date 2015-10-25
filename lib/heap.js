'use strict';

function newHeapNode(elem, data) {
  return {
    elem: elem,
    data: data,
    child: null,
    next: null
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
  var max = this.root;
  this.len -= 1;
  this.root = this.mergePairs(this.root.child);
  return max;
};

Heap.prototype.insert = function (elem, data) {
  this.root = this.merge(this.root, newHeapNode(elem, data));
  return ++this.len;
};

Heap.prototype.link = function (parent, child) {
  var firstChild = parent.child;
  parent.child = child;
  child.next = firstChild;
};

Heap.prototype.merge = function (heap1, heap2) {
  if (!heap1 || !heap2) {
    return heap1 || heap2;
  }

  if (heap1.elem > heap2.elem) {
    this.link(heap1, heap2);
    return heap1;
  }

  this.link(heap2, heap1);
  return heap2;
};

Heap.prototype.mergePairs = function (heapLL) {
  var paired = [];
  while (heapLL && heapLL.next) {
    var heap1 = heapLL;
    var heap2 = heap1.next;
    heapLL = heap2.next;
    paired.push(this.merge(heap1, heap2));
  }
  if (heapLL) {
    paired.push(heapLL);
  }

  var newRoot = paired.pop();
  while (paired.length) {
    var heap = paired.pop();
    newRoot = this.merge(heap, newRoot);
  }

  return newRoot;
};

module.exports = Heap;
