import {BehaviorSubject, Observable, Observer, Subscribable, Unsubscribable} from "rxjs";

export class ObservableSet<T> implements ReadonlyObservableSet<T> {

  private get _set() {return this._set$.value};
  private _set$: BehaviorSubject<ReadonlySet<T>>;

  value$: Observable<ReadonlySet<T>>;
  get value() {return this._set}

  get size() {return this._set.size}

  constructor(values?: T[]) {
    this._set$ = new BehaviorSubject<ReadonlySet<T>>(new Set<T>(values));
    this.value$ = this._set$.asObservable();
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

  filter(whitelist: T[]|ReadonlySet<T>|undefined) {
    const length = whitelist && 'size' in whitelist ? whitelist.size : whitelist?.length;

    if (!length) {
      this.clear();
      return;
    }

    const whitelistSet = whitelist instanceof Set ? whitelist : new Set(whitelist);
    const set = this.getCopy();

    for (let value of this._set) {
      if (whitelistSet.has(value)) continue;
      set.delete(value);
    }

    if (this._set.size !== set.size) this._set$.next(set);
  }

  clear() {
    if (!this._set.size) return;
    this._set$.next(new Set<T>());
  }

  add(value: T) {
    if (this._set.has(value)) return;
    const set = this.getCopy();
    set.add(value);
    this._set$.next(set);
  }

  set(values: T[] = []) {
    if (!values.length && !this.size) return;
    this._set$.next(new Set<T>(values));
  }

  delete(value: T) {
    if (!this._set.has(value)) return;
    const set = this.getCopy();
    set.delete(value);
    this._set$.next(set);
  }

  toggle(value: T, state?: boolean) {

    if (this._set.has(value)) {
      if (state === true) return;
      const set = this.getCopy();
      set.delete(value);
      this._set$.next(set);
      return;
    }

    if (state === false) return;
    const set = this.getCopy();
    set.add(value);
    this._set$.next(set);
  }

  has(value: T) {
    return this._set.has(value);
  }
}

export interface ReadonlyObservableSet<T> extends Iterable<T>, Subscribable<ReadonlySet<T>> {
  readonly size: number;
  readonly value: ReadonlySet<T>;
  readonly value$: Observable<ReadonlySet<T>>;
  has(value: T): boolean;
}
