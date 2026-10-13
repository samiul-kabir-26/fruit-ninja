/**
 * Lightweight Object Pool.
 * Minimizes object allocations in the game loop.
 */

export class ObjectPool {
  constructor(factoryFn, initialSize = 50, maxSize = 500) {
    this.factoryFn = factoryFn;
    this.maxSize = maxSize;
    this.pool = [];
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.factoryFn());
    }
  }

  obtain() {
    if (this.pool.length > 0) {
      const obj = this.pool.pop();
      obj.active = true;
      return obj;
    }
    const obj = this.factoryFn();
    obj.active = true;
    return obj;
  }

  release(obj) {
    if (!obj) return;
    obj.active = false;
    if (this.pool.length < this.maxSize) {
      this.pool.push(obj);
    }
  }
}
