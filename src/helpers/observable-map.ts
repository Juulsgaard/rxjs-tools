import {
  BehaviorSubject, concatMap, from, Observable, Observer, pairwise, share, skip, Subscribable, Unsubscribable
} from "rxjs";
import {distinctUntilChanged, filter, map} from "rxjs/operators";
import {cache} from "../operators/cache";

/**
 * A Map where the state and values can be observed
 * @category Observable Collections
 */
export class ObservableMap<TKey, TVal> implements ReadonlyObservableMap<TKey, TVal> {

  private get _map() {
    return this._map$.value
  };

  private _map$: BehaviorSubject<ReadonlyMap<TKey, TVal>>;
  /** @inheritDoc */
  readonly value$: Observable<ReadonlyMap<TKey, TVal>>;
  /** @inheritDoc */
  get value() {
    return this._map
  }
  /** @inheritDoc */
  readonly size$: Observable<number>;
  /** @inheritDoc */
  get size() {
    return this._map.size
  }

  /** @inheritDoc */
  readonly empty$: Observable<boolean>;
  /** @inheritDoc */
  get empty() {
    return this.size <= 0
  }

  constructor(values?: ReadonlyMap<TKey, TVal>) {
    this._map$ = new BehaviorSubject<ReadonlyMap<TKey, TVal>>(new Map(values));
    this.value$ = this._map$.asObservable();

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
      share()
    );

    this.itemAdded$ = this.itemUpdates$.pipe(
      filter(x => x.change === 'added'),
      share()
    );

    this.itemDelta$ = new Observable<ObservableMapItemChange<TKey, TVal>>(subscriber => {
      for (let change of this.processChanges(new Map(), this.value)) {
        subscriber.next(change);
      }
      return this.itemUpdates$.subscribe(subscriber);
    });
    //</editor-fold>

    //<editor-fold desc="State">
    this.size$ = this.value$.pipe(map(x => x.size), distinctUntilChanged());
    this.empty$ = this.size$.pipe(map(x => x <= 0), distinctUntilChanged());
    //</editor-fold>
  }

  [Symbol.iterator](): IterableIterator<[TKey, TVal]> {
    return this._map[Symbol.iterator]();
  }

  /** @inheritDoc */
  subscribe(observer: Partial<Observer<ReadonlyMap<TKey, TVal>>>): Unsubscribable {
    return this.value$.subscribe(observer);
  }

  private getCopy() {
    return new Map(this._map);
  }

  //<editor-fold desc="Actions">

  /**
   * Remove all keys not in the whitelist
   * @param whitelist - The keys to keep
   */
  filter(whitelist: ReadonlyArray<TKey> | ReadonlySet<TKey> | undefined): boolean {
    const length = whitelist && 'size' in whitelist ? whitelist.size : whitelist?.length;

    if (!length) {
      return this.clear();
    }

    const whitelistSet = whitelist instanceof Set ? whitelist : new Set(whitelist);
    const map = this.getCopy();

    for (let [key] of this._map) {
      if (whitelistSet.has(key)) continue;
      map.delete(key);
    }

    if (this._map.size !== map.size) {
      this._map$.next(map);
      return true;
    }

    return false;
  }

  /** Clear the collection */
  clear(): boolean {
    if (!this._map.size) return false;
    this._map$.next(new Map());
    return true;
  }

  /**
   * Add a value to the collection if the key is not in use
   * @param key - The key to use
   * @param value - The value to add
   * @return added - Returns true if the value was added
   */
  add(key: TKey, value: TVal): boolean {
    if (this._map.has(key)) return false;
    const map = this.getCopy();
    map.set(key, value);
    this._map$.next(map);
    return true;
  }

  /**
   * Add a value to the collection
   * @param key - The key to use
   * @param value - The value to add
   * @return added - Returns true if the value was added or changed
   */
  set(key: TKey, value: TVal): boolean {
    if (this._map.has(key) && this._map.get(key) === value) return false;

    const map = this.getCopy();
    map.set(key, value);
    this._map$.next(map);
    return true;
  }

  /**
   * Remove a key from the collection
   * @param key - The key to remove
   * @return removed - True if an item was removed
   */
  delete(key: TKey): boolean {
    if (!this._map.has(key)) return false;
    const map = this.getCopy();
    map.delete(key);
    this._map$.next(map);
    return true;
  }

  /**
   * Remove keys from the collection
   * @param values - The keys to remove
   * @return removed - True if items were removed
   */
  deleteRange(values: TKey[]): boolean {
    const map = this.getCopy();
    const size = map.size;
    values.forEach(v => map.delete(v));
    if (map.size === size) return false;
    this._map$.next(map);
    return true;
  }

  /**
   * Toggle a value in the map
   * @param key - The key to toggle
   * @param value - The value to insert if applicable
   * @param state - A forced state (`true` = always add, `false` = always delete)
   * @returns The applied change (`true` = item added, `false` = item removed, `undefined` = nothing changed)
   */
  toggle(key: TKey, value: TVal, state?: boolean): boolean | undefined {

    if (this._map.has(key)) {
      if (state === true) return undefined;
      const map = this.getCopy();
      map.delete(key);
      this._map$.next(map);
      return false;
    }

    if (state === false) return undefined;
    const map = this.getCopy();
    map.set(key, value);
    this._map$.next(map);
    return true;
  }

  /** @inheritDoc */
  has(key: TKey): boolean {
    return this._map.has(key);
  }

  /** @inheritDoc */
  has$(key: TKey): Observable<boolean> {
    return this.value$.pipe(
      map(x => x.has(key)),
      distinctUntilChanged(),
      cache()
    );
  }

  /** @inheritDoc */
  get(key: TKey): TVal | undefined {
    return this._map.get(key);
  }

  /** @inheritDoc */
  get$(key: TKey): Observable<TVal | undefined> {
    return this.value$.pipe(
      map(x => x.get(key)),
      distinctUntilChanged(),
      cache()
    );
  }

  /** Manually modify the inner collection */
  modify(modify: (map: Map<TKey, TVal>) => void) {
    const map = this.getCopy();
    modify(map);
    this._map$.next(map);
  }

  //</editor-fold>

  //<editor-fold desc="Changes">
  /** Emits all updates to the map */
  readonly updates$: Observable<ReadonlyMap<TKey, TVal>>;

  /** Emits for every item that is added/removed in the map */
  readonly itemUpdates$: Observable<ObservableMapItemChange<TKey, TVal>>;

  /** Emits for every item that is removed from the map */
  readonly itemRemoved$: Observable<ObservableMapItem<TKey, TVal>>;

  /** Emits for every item that is added to the map */
  readonly itemAdded$: Observable<ObservableMapItem<TKey, TVal>>;

  /** Emits for every item that is added/removed in the list, including the changes from an empty map to the current state */
  readonly itemDelta$: Observable<ObservableMapItemChange<TKey, TVal>>;

  /**
   * Processes changes to individual items
   * @private
   */
  private* processChanges(
    prevMap: ReadonlyMap<TKey, TVal>,
    nextMap: ReadonlyMap<TKey, TVal>
  ): Generator<ObservableMapItemChange<TKey, TVal>> {

    const old = new Map(prevMap);

    for (let [key, value] of nextMap) {
      if (old.has(key)) {
        old.delete(key);
        continue;
      }

      yield {key, value, change: 'added'};
    }

    for (let [key, value] of old) {
      yield {key, value, change: 'removed'};
    }
  }

  //</editor-fold>
}

/**
 * An immutable Map where the state and values can be observed
 * @category Observable Collections
 */
export interface ReadonlyObservableMap<TKey, TVal> extends Iterable<[TKey, TVal]>, Subscribable<ReadonlyMap<TKey, TVal>> {
  /** The number of items in the collection */
  readonly size: number;
  /** An observable emitting the number of items in the collection */
  readonly size$: Observable<number>;
  /** True if the collection is empty */
  readonly empty: boolean;
  /** An observable emitting true if the collection is empty */
  readonly empty$: Observable<boolean>;
  /** The inner non-observable map */
  readonly value: ReadonlyMap<TKey, TVal>;
  /** An observable emitting the inner non-observable map */
  readonly value$: Observable<ReadonlyMap<TKey, TVal>>;

  /** Check if a key exists in the collection */
  has(key: TKey): boolean;
  /** Create am observable emitting true if a key exists in the collection */
  has$(key: TKey): Observable<boolean>;

  /** Try to read a value with a given key */
  get(key: TKey): TVal | undefined;
  /** Create an observable emitting the value under a given key */
  get$(key: TKey): Observable<TVal | undefined>;
}

/**
 * An item in an `ObservableMap`
 * @category Observable Collections
 */
export interface ObservableMapItem<TKey, TVal> {
  key: TKey;
  value: TVal;
}

/**
 * The change state of an item in an `ObservableMap`
 * @category Observable Collections
 */
export interface ObservableMapItemChange<TKey, TVal> extends ObservableMapItem<TKey, TVal> {
  change: 'added' | 'removed';
}
