namespace TDA {
  class QueueNode<T> {
    value: T;
    next: QueueNode<T> | null = null;
    constructor(value: T) {
      this.value = value;
    }
  }

  export class Queue<T> {
    private head: QueueNode<T> | null = null;
    private tail: QueueNode<T> | null = null;
    private count = 0;

    get size(): number {
      return this.count;
    }

    isEmpty(): boolean {
      return this.count === 0;
    }

    enqueue(value: T): void {
      const node = new QueueNode(value);
      if (!this.tail) {
        this.head = node;
        this.tail = node;
      } else {
        this.tail.next = node;
        this.tail = node;
      }
      this.count++;
    }

    dequeue(): T | undefined {
      if (!this.head) return undefined;
      const node = this.head;
      this.head = node.next;
      if (!this.head) this.tail = null;
      this.count--;
      return node.value;
    }

    peekFront(): T | undefined {
      return this.head ? this.head.value : undefined;
    }

    some(predicate: (value: T) => boolean): boolean {
      let current = this.head;
      while (current) {
        if (predicate(current.value)) return true;
        current = current.next;
      }
      return false;
    }

    toArray(): T[] {
      const result: T[] = [];
      let current = this.head;
      while (current) {
        result.push(current.value);
        current = current.next;
      }
      return result;
    }
  }
}
