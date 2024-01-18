import {BehaviorSubject, concatMap, from, Observable, pairwise, share, skip, startWith} from "rxjs";
import {distinctUntilChanged, filter, map} from "rxjs/operators";
import {cache, persistentCache} from "../operators/cache";
import {arrToLookup, Disposable} from "@juulsgaard/ts-tools";

export class ObservableStack<T> implements Disposable {

  private readonly _items$ = new BehaviorSubject<T[]>([]);
  /** An observable containing the items of the stack from bottom to top */
  readonly items$ = this._items$.asObservable();

  /** A list of items in the stack from bottom to top */
  get items() {
    return this._items$.value
  };

  private set items(items: T[]) {
    this._items$.next(items)
  }

  get length() {return this.items.length;}
  readonly length$: Observable<number>;

  get empty() {return this.items.length <= 0;}
  readonly empty$: Observable<boolean>;

  constructor() {

    //<editor-fold desc="Changes">
    this.updates$ = this.items$.pipe(skip(1));

    this.itemUpdates$ = this.items$.pipe(
      pairwise(),
      map(([last, next]) => this.processChanges(last, next)),
      concatMap(x => from(x)),
      share()
    );

    this.itemRemoved$ = this.itemUpdates$.pipe(
      filter(x => x.change === 'removed'),
      map(({item, index}) => ({item, index})),
      share()
    );

    this.itemAdded$ = this.itemUpdates$.pipe(
      filter(x => x.change === 'added'),
      map(({item, index}) => ({item, index})),
      share()
    );

    this.itemDelta$ = new Observable<ObservableStackItemChange<T>>(subscriber => {
      for (let change of this.processChanges([], this.items)) {
        subscriber.next(change);
      }
      return this.itemUpdates$.subscribe(subscriber);
    });
    //</editor-fold>

    //<editor-fold desc="Top">
    this.top$ = this.items$.pipe(
      map(x => x.at(-1)),
      distinctUntilChanged(),
      cache(),
    );

    this.topDelta$ = this.items$.pipe(
      startWith([] as T[]),
      pairwise(),
      map(([prevList, nextList]) => {
        const item = nextList.at(-1);
        return {item, added: !item ? false : prevList.includes(item)};
      }),
      distinctUntilChanged((prev, next) => prev.item === next.item),
      share()
    );
    //</editor-fold>

    //<editor-fold desc="Bottom">
    this.bottom$ = this.items$.pipe(
      map(x => x.at(0)),
      distinctUntilChanged(),
      persistentCache(),
    );

    this.bottomDelta$ = this.items$.pipe(
      startWith([] as T[]),
      pairwise(),
      map(([prevList, nextList]) => {
        const item = nextList.at(0);
        return {item, added: !item ? false : prevList.includes(item)};
      }),
      distinctUntilChanged((prev, next) => prev.item === next.item),
      share()
    );
    //</editor-fold>

    //<editor-fold desc="State">
    this.length$ = this.items$.pipe(
      map(x => x.length),
      distinctUntilChanged(),
      persistentCache(),
    );

    this.empty$ = this.length$.pipe(
      map(x => x <= 0),
      distinctUntilChanged(),
      persistentCache(),
    );
    //</editor-fold>
  }

  //<editor-fold desc="Top">
  /** Element at the top of the stack */
  get top() {return this.items.at(-1);}

  /** Observable returning the element at the top of the stack */
  readonly top$: Observable<T | undefined>;

  /** Observable returning the current top element and whether it was just added */
  readonly topDelta$: Observable<ObservableStackDelta<T>>;
  //</editor-fold>

  //<editor-fold desc="Bottom">
  /** Element at the bottom of the stack */
  get bottom() {return this.items.at(0);}

  /** Observable returning the element at the bottom of the stack */
  readonly bottom$: Observable<T | undefined>;

  /** Observable returning the current bottom element and whether it was just added */
  readonly bottomDelta$: Observable<ObservableStackDelta<T>>;
  //</editor-fold>

  //<editor-fold desc="Changes">

  /** Emits all updates to the stack */
  readonly updates$: Observable<T[]>;

  /** Emits for every item that is added or removed from the stack */
  readonly itemUpdates$: Observable<ObservableStackItemChange<T>>;

  /** Emits for every item that is removed from the stack */
  readonly itemRemoved$: Observable<ObservableStackItem<T>>;

  /** Emits for every item that is added to the stack */
  readonly itemAdded$: Observable<ObservableStackItem<T>>;

  /** Emits for every item that is added/removed in the stack, including the changes from an empty stack to the current state */
  readonly itemDelta$: Observable<ObservableStackItemChange<T>>;

  /**
   * Processes changes to individual items
   * @param prevList
   * @param nextList
   * @private
   */
  private* processChanges(prevList: T[], nextList: T[]): Generator<ObservableStackItemChange<T>> {

    const oldLookup = arrToLookup(
      prevList,
      x => x,
      (_, i) => i
    ) as Map<T, number[]>;

    const changes: ObservableStackItemChange<T>[] = [];

    // Determine all additions and moves
    for (let i = 0; i < nextList.length; i++) {
      const data = nextList[i] as T;
      const oldItems = oldLookup.get(data);

      if (!oldItems) {
        changes.push({item: data, index: i, change: 'added'});
        continue;
      }

      const oldIndex = oldItems.shift();
      if (oldIndex !== undefined) continue;

      changes.push({item: data, index: i, change: 'added'});
    }

    // Emit all removals first
    for (let [data, indices] of oldLookup) {
      for (let index of indices) {
        yield {item: data, index, change: 'removed'};
      }
    }

    // Remove remaining changes
    for (let change of changes) {
      yield change;
    }
  }

  //</editor-fold>

  //<editor-fold desc="Actions">
  /**
   * Removes an item from the scheduler
   * @param item
   */
  removeItem(item: T): boolean {
    const index = this.items.indexOf(item);
    if (index < 0) return false;

    const arr = [...this.items];
    arr.splice(index, 1);
    this.items = arr;
    return true;
  }

  /**
   * Remove the bottom element from the stack and return it
   */
  removeFromBottom(): T | undefined;
  /**
   * Remove the bottom x elements from the stack and return them
   * @param count - The amount of elements to remove
   */
  removeFromBottom(count: number): T[];
  removeFromBottom(count?: number): T | T[] | undefined {

    if (count !== undefined) {
      if (count < 1) return [];
      if (!this.items.length) return [];
      const items = this.items.slice(0, count);
      this.items = this.items.slice(count);
      return items;
    }

    if (!this.items.length) return undefined;
    const item = this.items.at(0);
    this.items = this.items.slice(1);
    return item;
  }

  /**
   * Remove the top element from the stack and return it
   */
  pop(): T | undefined;
  /**
   * Remove the top x elements from the stack and return it
   * @param count - The amount of elements to remove
   */
  pop(count: number): T[];
  pop(count?: number): T | T[] | undefined {

    if (count !== undefined) {
      if (count < 1) return [];
      if (!this.items.length) return [];
      const start = count * -1;
      const items = this.items.slice(start);
      this.items = this.items.slice(0, start);
      return items;
    }

    if (!this.items.length) return undefined;
    const item = this.items.at(-1);
    this.items = this.items.slice(0, -1);
    return item;
  }

  /**
   * Add item to the top of the stack
   * @param item - Item to add
   */
  push(item: T): void;
  /**
   * Add items to the top of the stack
   * @param items - Items to add
   */
  push(...items: T[]): void;
  push(...items: T[]): void {
    this.items = [...this.items, ...items];
  }

  /**
   * Add item to the bottom of the stack
   * @param item - Item to add
   */
  addToBottom(item: T): void;
  /**
   * Add items to the bottom of the stack
   * @param items - Items to add
   */
  addToBottom(...items: T[]): void;
  addToBottom(...items: T[]): void {
    this.items = [...items, ...this.items];
  }

  /**
   * Checks if the item exists in the queue
   * @param item
   */
  contains(item: T) {
    return this.items.includes(item);
  }

  /**
   * Remove all elements from the set
   */
  clear() {
    this.items = [];
  }

  //</editor-fold>

  /**
   * Dispose of the Scheduler.
   * This closes all subjects.
   */
  dispose() {
    this._items$.complete();
  }
}

export interface ObservableStackDelta<T> {
  item?: T;
  added: boolean;
}

export interface ObservableStackItem<T> {
  item: T;
  index: number;
}

export interface ObservableStackItemChange<T> extends ObservableStackItem<T> {
  change: 'added'|'removed';
}
