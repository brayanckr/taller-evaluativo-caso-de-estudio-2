namespace TDA {
  class StackNode<T> {
    value: T;
    next: StackNode<T> | null = null;
    constructor(value: T) {
      this.value = value;
    }
  }


  export class Stack<T> {
    private head: StackNode<T> | null = null;
    private count = 0;

    get size(): number {
      return this.count;
    }

    isEmpty(): boolean {
      return this.count === 0;
    }

    push(value: T): void {
      const node = new StackNode(value);
      node.next = this.head;
      this.head = node;
      this.count++;
    }

    pop(): T | undefined {
      if (!this.head) return undefined;
      const node = this.head;
      this.head = node.next;
      this.count--;
      return node.value;
    }

    peek(): T | undefined {
      return this.head ? this.head.value : undefined;
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
