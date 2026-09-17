namespace TDA {
  /**
   * Node used internally by LinkedList.
   */
  class ListNode<T> {
    value: T;
    next: ListNode<T> | null = null;
    constructor(value: T) {
      this.value = value;
    }
  }

  /**
   * Singly linked list implemented from scratch (no arrays used for storage).
   * Used for the equipment inventory: items are added/removed at any time
   * and the whole collection is walked to build the inventory screen.
   */
  export class LinkedList<T> {
    private head: ListNode<T> | null = null;
    private tail: ListNode<T> | null = null;
    private count = 0;

    get size(): number {
      return this.count;
    }

    append(value: T): void {
      const node = new ListNode(value);
      if (!this.head || !this.tail) {
        this.head = node;
        this.tail = node;
      } else {
        this.tail.next = node;
        this.tail = node;
      }
      this.count++;
    }

    /** Removes the first element that matches the predicate. Returns true if something was removed. */
    removeWhere(predicate: (value: T) => boolean): boolean {
      let prev: ListNode<T> | null = null;
      let current = this.head;
      while (current) {
        if (predicate(current.value)) {
          if (prev) {
            prev.next = current.next;
          } else {
            this.head = current.next;
          }
          if (current === this.tail) {
            this.tail = prev;
          }
          this.count--;
          return true;
        }
        prev = current;
        current = current.next;
      }
      return false;
    }

    find(predicate: (value: T) => boolean): T | undefined {
      let current = this.head;
      while (current) {
        if (predicate(current.value)) return current.value;
        current = current.next;
      }
      return undefined;
    }

    filter(predicate: (value: T) => boolean): T[] {
      const result: T[] = [];
      let current = this.head;
      while (current) {
        if (predicate(current.value)) result.push(current.value);
        current = current.next;
      }
      return result;
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
