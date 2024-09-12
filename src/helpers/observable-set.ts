import {
  BehaviorSubject, concatMap, from, Observable, Observer, pairwise, share, skip, Subscribable, Unsubscribable
} from "rxjs";
import {distinctUntilChanged, filter, map} from "rxjs/operators";
import {cache} from "../operators/cache";

/**
 * A Set where the state and values can be observed
 * @category Observable Collections
 */
export class ObservableSet<T> implements ReadonlyObservableSet<T> {

  private get _set() {return this._set$.value};
  private _set$: BehaviorSubject<ReadonlySet<T>>;

  /** @inheritDoc */
  readonly value$: Observable<ReadonlySet<T>>;
  /** @inheritDoc */
  get value() {return this._set}

  /** @inheritDoc */
  readonly size$: Observable<number>;
  /** @inheritDoc */
  get size() {return this._set.size}

  /** @inheritDoc */
  readonly empty$: Observable<boolean>;
  /** @inheritDoc */
  get empty() {return this.size <= 0}

  /** @inheritDoc */
  readonly array$: Observable<T[]>;
  /** @inheritDoc */
  get array() {return Array.from(this.value)};

  constructor(values?: T[]) {
    this._set$ = new BehaviorSubject<ReadonlySet<T>>(new Set<T>(values));
    this.value$ = this._set$.asObservable();

    //<editor-fold desc="Changes">
    this.updates$ = this.value$.pipe(skip(1));

    this.itemUpdates$ = this.value$.pipe(
      pairwise(),
      map(([last, next]) => this.processChanges(last, next)),
      concatMap(x => from(x)),
      share()
    );

    this.itemRemoved$ = this.itemUpdates$.pipe(
      filter(x => x.change === 'removed'),
      map(x => x.item),
      share()
    );

    this.itemAdded$ = this.itemUpdates$.pipe(
      filter(x => x.change === 'added'),
      map(x => x.item),
      share()
    );

    this.itemDelta$ = new Observable<ObservableSetItemChange<T>>(subscriber => {
      for (let change of this.processChanges(new Set(), this.value)) {
        subscriber.next(change);
      }
      return this.itemUpdates$.subscribe(subscriber);
    });
    //</editor-fold>

    //<editor-fold desc="State">
    this.size$ = this.value$.pipe(map(x => x.size), distinctUntilChanged());
    this.empty$ = this.size$.pipe(map(x => x <= 0), distinctUntilChanged());
    this.array$ = this.value$.pipe(map(x => Array.from(x)));
    //</editor-fold>
  }

  /** @inheritDoc */
  [Symbol.iterator](): IterableIterator<T> {
    return this._set[Symbol.iterator]();
  }

  /** @inheritDoc */
  subscribe(observer: Partial<Observer<ReadonlySet<T>>>): Unsubscribable {
    return this.value$.subscribe(observer);
  }

  private getCopy() {
    return new Set<T>(this._set);
  }

  //<editor-fold desc="Actions">

  /**
   * Remove all keys not in the whitelist
   * @param whitelist - The keys to keep
   */
  filter(whitelist: T[]|ReadonlySet<T>|undefined): boolean {
    const length = whitelist && 'size' in whitelist ? whitelist.size : whitelist?.length;

    if (!length) {
      return this.clear();
    }

    const whitelistSet = whitelist instanceof Set ? whitelist : new Set(whitelist);
    const set = this.getCopy();

    for (let value of this._set) {
      if (whitelistSet.has(value)) continue;
      set.delete(value);
    }

    if (this._set.size !== set.size) {
      this._set$.next(set);
      return true;
    }

    return false;
  }

  /** Clear the collection */
  clear(): boolean {
    if (!this._set.size) return false;
    this._set$.next(new Set<T>());
    return true;
  }

  /**
   * Add a value to the collection is not already present
   * @param value - The value to add
   * @return added - Returns true if the value was added
   */
  add(value: T): boolean {
    if (this._set.has(value)) return false;
    const set = this.getCopy();
    set.add(value);
    this._set$.next(set);
    return true;
  }

  /**
   * Add a list of values to the collection is not already present
   * @param values - The values to add
   * @return added - Returns true if any value was added
   */
  addRange(values: T[]): boolean {
    const set = this.getCopy();
    const size = set.size;
    values.forEach(v => set.add(v));
    if (set.size === size) return false;
    this._set$.next(set);
    return true;
  }

  /**
   * Reset the values in the collection to the provided list
   * @param values - The values to set
   * @return changed - Returns true if the collection changed
   */
  set(values: T[] = []): boolean {
    if (!values.length && !this.size) return false;

    if (values.length === this._set.size) {
      const same = values.every(x => this.has(x));
      if (same) return false;
    }

    this._set$.next(new Set<T>(values));
    return true;
  }

  /**
   * Remove a value from the collection
   * @param value - The key to remove
   * @return removed - True if the value existed
   */
  delete(value: T): boolean {
    if (!this._set.has(value)) return false;
    const set = this.getCopy();
    set.delete(value);
    this._set$.next(set);
    return true;
  }

  /**
   * Remove values from the collection
   * @param values - The values to remove
   * @return removed - True if any values were removed
   */
  deleteRange(values: T[]): boolean {
    const set = this.getCopy();
    const size = set.size;
    values.forEach(v => set.delete(v));
    if (set.size === size) return false;
    this._set$.next(set);
    return true;
  }

  /**
   * Toggle a value in the set
   * @param value - The value to toggle
   * @param state - A forced state (`true` = always add, `false` = always delete)
   * @returns The applied change (`true` = item added, `false` = item removed, `undefined` = nothing changed)
   */
  toggle(value: T, state?: boolean): boolean|undefined {

    if (this._set.has(value)) {
      if (state === true) return undefined;
      const set = this.getCopy();
      set.delete(value);
      this._set$.next(set);
      return false;
    }

    if (state === false) return undefined;
    const set = this.getCopy();
    set.add(value);
    this._set$.next(set);
    return true;
  }

  /** @inheritDoc */
  has(value: T): boolean {
    return this._set.has(value);
  }

  /** @inheritDoc */
  has$(value: T): Observable<boolean> {
    return this.value$.pipe(
      map(x => x.has(value)),
      distinctUntilChanged(),
      cache()
    );
  }

  /** Manually modify the inner collection */
  modify(modify: (set: Set<T>) => void) {
    const set = this.getCopy();
    modify(set);
    this._set$.next(set);
  }
  //</editor-fold>

  //<editor-fold desc="Changes">
  /** Emits all updates to the set */
  readonly updates$: Observable<ReadonlySet<T>>;

  /** Emits for every item that is added/removed in the set */
  readonly itemUpdates$: Observable<ObservableSetItemChange<T>>;

  /** Emits for every item that is removed from the set */
  readonly itemRemoved$: Observable<T>;

  /** Emits for every item that is added to the set */
  readonly itemAdded$: Observable<T>;

  /** Emits for every item that is added/removed in the list, including the changes from an empty set to the current state */
  readonly itemDelta$: Observable<ObservableSetItemChange<T>>;

  /**
   * Processes changes to individual items
   * @private
   */
  private *processChanges(prevSet: ReadonlySet<T>, nextSet: ReadonlySet<T>): Generator<ObservableSetItemChange<T>> {

    const old = new Set<T>(prevSet);

    for (let item of nextSet) {
      if (old.has(item)) {
        old.delete(item);
        continue;
      }

      yield {item, change: 'added'};
    }

    for (let item of old) {
      yield {item, change: 'removed'};
    }
  }
  //</editor-fold>
}

/**
 * An immutable Set where the state and values can be observed
 * @category Observable Collections
 */
export interface ReadonlyObservableSet<T> extends Iterable<T>, Subscribable<ReadonlySet<T>> {
  /** The number of items in the collection */
  readonly size: number;
  /** An observable emitting the number of items in the collection */
  readonly size$: Observable<number>;
  /** True if the collection is empty */
  readonly empty: boolean;
  /** An observable emitting true if the collection is empty */
  readonly empty$: Observable<boolean>;
  /** The inner non-observable Set */
  readonly value: ReadonlySet<T>;
  /** An observable emitting the inner non-observable Set */
  readonly value$: Observable<ReadonlySet<T>>;
  /** The values of the set as an array */
  readonly array: ReadonlyArray<T>;
  /** An observable emitting the values of the set as an array */
  readonly array$: Observable<ReadonlyArray<T>>;

  /** Check if a key exists in the collection */
  has(key: T): boolean;
  /** Create am observable emitting true if a key exists in the collection */
  has$(key: T): Observable<boolean>;
}

/**
 * The change state of an item in an `ObservableSet`
 * @category Observable Collections
 */
export interface ObservableSetItemChange<T> {
  item: T;
  change: 'added'|'removed';
}
