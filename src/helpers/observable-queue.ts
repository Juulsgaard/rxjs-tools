import {BehaviorSubject, concat, Observable, pairwise, Subject} from "rxjs";
import {distinctUntilChanged, first, map} from "rxjs/operators";
import {persistentCache} from "../operators/cache";
import {arrToLookup, Disposable} from "@juulsgaard/ts-tools";

export class ObservableQueue<TData> implements Disposable {

  private readonly _items$ = new BehaviorSubject<TData[]>([]);
  /**
   * An observable containing the items of the queue
   */
  readonly items$ = this._items$.asObservable();

  /**
   * A list of items in the queue
   */
  get items() {return this._items$.value};
  private set items(items: TData[]) {this._items$.next(items)}

  constructor() {
    this.items$.pipe(
      pairwise()
    ).subscribe(([prevList, nextList]) => this.processChanges(prevList, nextList));

    //<editor-fold desc="Front">
    this.front$ = this.items$.pipe(
      map(x => x.at(0)),
      distinctUntilChanged(),
      persistentCache(),
    );

    const firstFront$ = this.front$.pipe(
      first(),
      map(item => ({added: !!item, item}))
    );
    const frontChanges$ = this.items$.pipe(
      pairwise(),
      map(([oldItems, newItems]) => ({added: newItems.length > oldItems.length, item: newItems.at(0)}))
    );
    this.frontChanges$ = concat(firstFront$, frontChanges$).pipe(
      distinctUntilChanged((prev, next) => prev.item === next.item)
    );
    //</editor-fold>

    //<editor-fold desc="Back">
    this.back$ = this.items$.pipe(
      map(x => x.at(-1)),
      distinctUntilChanged(),
      persistentCache(),
    );

    const firstBack$ = this.back$.pipe(
      first(),
      map(item => ({added: !!item, item}))
    );
    const backChanges$ = this.items$.pipe(
      pairwise(),
      map(([oldItems, newItems]) => ({added: newItems.length > oldItems.length, item: newItems.at(-1)}))
    );
    this.backChanges$ = concat(firstBack$, backChanges$).pipe(
      distinctUntilChanged((prev, next) => prev.item === next.item)
    );
    //</editor-fold>

    //<editor-fold desc="State">
    this.length$ = this.items$.pipe(
      map(x => x.length),
      distinctUntilChanged(),
      persistentCache(),
    );
    
    this.empty$ = this.length$.pipe(
      map(x => x > 0),
      distinctUntilChanged(),
      persistentCache(),
    );
    //</editor-fold>
  }

  //<editor-fold desc="Front">
  /**
   * Element at the front of the queue
   */
  get front() {
    return this.items.at(0);
  }

  /**
   * Observable returning the element at the front of the queue
   */
  readonly front$: Observable<TData|undefined>;

  /** Observable returning the current front element and whether it was just added */
  readonly frontChanges$: Observable<ObservableQueueChange<TData>>;
  //</editor-fold>

  //<editor-fold desc="Back">
  /**
   * Element at the back of the queue
   */
  get back() {
    return this.items.at(-1);
  }

  /**
   * Observable returning the element at the back of the queue
   */
  readonly back$: Observable<TData|undefined>;

  /** Observable returning the current back element and whether it was just added */
  readonly backChanges$: Observable<ObservableQueueChange<TData>>;
  //</editor-fold>

  //<editor-fold desc="State">

  get length() {
    return this.items.length;
  }
  
  readonly length$: Observable<number>;

  get empty() {
    return this.items.length < 1;
  }

  readonly empty$: Observable<boolean>;
  //</editor-fold>

  //<editor-fold desc="Changes">

  private readonly _updates$ = new Subject<TData[]>();
  /**
   * Emits all updates to the queue
   */
  readonly updates$ = this._updates$.asObservable();

  private _itemUpdates$ = new Subject<ObservableQueueItemChange<TData>>();
  /**
   * Emits for every item that is updated in the list
   */
  readonly itemUpdates$ = this._itemUpdates$.asObservable();

  /**
   * Processes changes to individual items and emits the changes
   * @param prevList
   * @param nextList
   * @private
   */
  private processChanges(prevList: TData[], nextList: TData[]) {

    this._updates$.next(nextList);

    const oldLookup = arrToLookup(prevList, x => x, (_, i) => i) as Map<TData, number[]>;

    for (let i = 0; i < nextList.length; i++) {
      const data = nextList[i] as TData;
      const oldIndexes = oldLookup.get(data);

      if (!oldIndexes) {
        this._itemUpdates$.next({item: data, position: i, previousPosition: undefined});
        continue;
      }

      const oldIndex = oldIndexes.shift();
      if (oldIndex === undefined) {
        this._itemUpdates$.next({item: data, position: i, previousPosition: undefined});
        continue;
      }

      this._itemUpdates$.next({item: data, position: i, previousPosition: oldIndex});
    }

    for (let [data, indices] of oldLookup) {
      for (let index of indices) {
        this._itemUpdates$.next({item: data, previousPosition: index, position: undefined});
      }
    }
  }
  //</editor-fold>

  //<editor-fold desc="Actions">
  /**
   * Removes an item from the scheduler
   * @param item
   */
  removeItem(item: TData): boolean {
    const index = this.items.indexOf(item);
    if (index < 0) return false;

    const arr = [...this.items];
    arr.splice(index, 1);
    this.items = arr;
    return true;
  }

  /**
   * Remove the front element from the queue and return it
   */
  popItem(): TData|undefined {
    if (!this.items.length) return undefined;
    const item = this.items[0];
    this.items = this.items.slice(1);
    return item;
  }

  /**
   * Add item to the end of the scheduler queue
   * @param item
   */
  enqueue(item: TData): void {
    this.items = [...this.items, item];
  }

  /**
   * Add item to the front of the scheduler queue
   * @param item
   */
  push(item: TData): void {
    this.items = [item, ...this.items];
  }

  /**
   * Checks if the item exists in the queue
   * @param item
   */
  contains(item: TData) {
    return this.items.includes(item);
  }
  //</editor-fold>

  /**
   * Dispose of the Scheduler.
   * This closes all subjects.
   */
  dispose() {
    this._items$.complete();
    this._updates$.complete();
    this._itemUpdates$.complete();
  }
}

export interface ObservableQueueChange<T> {
  added: boolean;
  item?: T;
}

export interface ObservableQueueItemChange<T> {
  item: T;
  previousPosition: number | undefined;
  position: number | undefined;
}
