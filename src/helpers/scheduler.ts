import {BehaviorSubject, concat, Observable, pairwise} from "rxjs";
import {distinctUntilChanged, first, map} from "rxjs/operators";
import {persistentCache} from "../operators/cache";

export class Scheduler<TData> {

  items$ = new BehaviorSubject<TData[]>([]);
  get items() {return this.items$.value};
  private set items(items: TData[]) {this.items$.next(items)}

  constructor() {
    this.items$.subscribe(items => this.processList(items));

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

    this.empty$ = this.items$.pipe(
      map(x => !x.length),
      distinctUntilChanged(),
      persistentCache(),
    );
  }

  /**
   * Element at the front of the queue
   */
  get front() {
    return this.items.at(0);
  }

  /**
   * Observable returning the element at the front of the queue
   */
  front$: Observable<TData|undefined>;

  /** Observable returning the current front element and whether it was just added */
  frontChanges$: Observable<SchedulerChange<TData>>;

  /**
   * Element at the back of the queue
   */
  get back() {
    return this.items.at(-1);
  }

  /**
   * Observable returning the element at the back of the queue
   */
  back$: Observable<TData|undefined>;

  /** Observable returning the current back element and whether it was just added */
  backChanges$: Observable<SchedulerChange<TData>>;

  get empty() {
    return this.items.length < 1;
  }

  empty$: Observable<boolean>;


  private updateItem?: (item: TData, position: number) => void;

  /**
   * Define a method to update items when the queue updates
   * @param updateHandler - A method run on all items in the queue
   */
  handleItemUpdates(updateHandler: (item: TData, position: number) => void) {
    this.updateItem = updateHandler;
  }

  private onUpdate?: (items: TData[]) => void;

  /**
   * Define a method that triggers whenever the contents of the queue is changed
   * @param updateHandler - A method run on updates
   */
  handleUpdates(updateHandler: (items: TData[]) => void) {
    this.onUpdate = updateHandler;
  }

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

  contains(item: TData) {
    return this.items.includes(item);
  }

  private processList(items: TData[]) {
    if (this.updateItem) {
      for (let i = 0; i < items.length; i++) {
        this.updateItem(items[i], i);
      }
    }

    if (this.onUpdate) {
      this.onUpdate(items);
    }
  }

}

export interface SchedulerChange<T> {
  added: boolean;
  item?: T;
}
