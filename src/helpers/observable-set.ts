import {
  BehaviorSubject, concatMap, from, Observable, Observer, pairwise, share, skip, Subscribable, Unsubscribable
} from "rxjs";
import {distinctUntilChanged, map} from "rxjs/operators";

export class ObservableSet<T> implements ReadonlyObservableSet<T> {

  private get _set() {return this._set$.value};
  private _set$: BehaviorSubject<ReadonlySet<T>>;

  readonly value$: Observable<ReadonlySet<T>>;
  get value() {return this._set}

  readonly size$: Observable<number>;
  get size() {return this._set.size}

  readonly empty$: Observable<boolean>;
  get empty() {return this.size <= 0}

  readonly array$: Observable<T[]>;
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

  [Symbol.iterator](): IterableIterator<T> {
    return this._set[Symbol.iterator]();
  }

  subscribe(observer: Partial<Observer<ReadonlySet<T>>>): Unsubscribable {
    return this.value$.subscribe(observer);
  }

  private getCopy() {
    return new Set<T>(this._set);
  }

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

  clear(): boolean {
    if (!this._set.size) return false;
    this._set$.next(new Set<T>());
    return true;
  }

  add(value: T): boolean {
    if (this._set.has(value)) return false;
    const set = this.getCopy();
    set.add(value);
    this._set$.next(set);
    return true;
  }

  addRange(values: T[]): boolean {
    const set = this.getCopy();
    const size = set.size;
    values.forEach(v => set.add(v));
    if (set.size === size) return false;
    this._set$.next(set);
    return true;
  }

  set(values: T[] = []): boolean {
    if (!values.length && !this.size) return false;

    if (values.length === this._set.size) {
      const same = values.every(x => this.has(x));
      if (same) return false;
    }

    this._set$.next(new Set<T>(values));
    return true;
  }

  delete(value: T): boolean {
    if (!this._set.has(value)) return false;
    const set = this.getCopy();
    set.delete(value);
    this._set$.next(set);
    return true;
  }

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

  has(value: T): boolean {
    return this._set.has(value);
  }

  modify(modify: (set: Set<T>) => void) {
    const set = this.getCopy();
    modify(set);
    this._set$.next(set);
  }

  //<editor-fold desc="Changes">
  /**
   * Emits all updates to the set
   */
  readonly updates$: Observable<ReadonlySet<T>>;

  /**
   * Emits for every item that is added/removed in the set
   */
  readonly itemUpdates$: Observable<ObservableSetItemChange<T>>;

  /**
   * Emits for every item that is added/removed in the list, including the changes from an empty set to the current state
   */
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

export interface ReadonlyObservableSet<T> extends Iterable<T>, Subscribable<ReadonlySet<T>> {
  readonly size: number;
  readonly size$: Observable<number>;
  readonly value: ReadonlySet<T>;
  readonly value$: Observable<ReadonlySet<T>>;
  readonly array: ReadonlyArray<T>;
  readonly array$: Observable<ReadonlyArray<T>>;
  has(value: T): boolean;
}

export interface ObservableSetItemChange<T> {
  item: T;
  change: 'added'|'removed';
}
