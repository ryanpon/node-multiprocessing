'use strict'

const newHeapNode = (elem, data) => ({
  elem: elem,
  data: data,
  child: null,
  next: null
})

class Heap {

  constructor() {
    this.root = null
    this.len = 0
  }

  popMax() {
    if (!this.len) {
      return null
    }
    const max = this.root
    this.len -= 1
    this.root = this.mergePairs(this.root.child)
    return max
  }

  insert(elem, data) {
    this.root = this.merge(this.root, newHeapNode(elem, data))
    return ++this.len
  }

  link(parent, child) {
    const firstChild = parent.child
    parent.child = child
    child.next = firstChild
  }

  merge(heap1, heap2) {
    if (!heap1 || !heap2) {
      return heap1 || heap2
    }

    if (heap1.elem > heap2.elem) {
      this.link(heap1, heap2)
      return heap1
    }

    this.link(heap2, heap1)
    return heap2
  }

  mergePairs(heapLL) {
    const paired = []
    while (heapLL && heapLL.next) {
      const heap1 = heapLL
      const heap2 = heap1.next
      heapLL = heap2.next
      paired.push(this.merge(heap1, heap2))
    }
    if (heapLL) {
      paired.push(heapLL)
    }

    let newRoot = paired.pop()
    while (paired.length) {
      const heap = paired.pop()
      newRoot = this.merge(heap, newRoot)
    }

    return newRoot
  }

}

module.exports = Heap
