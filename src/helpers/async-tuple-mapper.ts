import {Disposable} from "@juulsgaard/ts-tools";
import {from, Observable, Subject, Subscription, Unsubscribable} from "rxjs";
import {AsyncOrSyncVal, AsyncVal, UnwrappedAsyncOrSyncVal, UnwrappedAsyncVal} from "./async-value-mapper";
import {isSubscribable} from "../util/type-guards";

export type AsyncTuple<T extends unknown[]> = {[K in keyof T]: AsyncVal<T[K]>};
export type AsyncOrSyncTuple<T extends unknown[]> = {[K in keyof T]: AsyncOrSyncVal<T[K]>};
export type UnwrappedAsyncTuple<T extends AsyncTuple<unknown[]>, TMod = never> = {[K in keyof T]: UnwrappedAsyncVal<T[K], TMod>};
export type UnwrappedAsyncOrSyncTuple<T extends AsyncOrSyncTuple<unknown[]>, TMod = never> = {[K in keyof T]: UnwrappedAsyncOrSyncVal<T[K], TMod>};

abstract class BaseAsyncTupleMapper<T extends unknown[]> implements Disposable {

  private disposed = false;

  private readonly _values$ = new Subject<T>();
  public readonly values$ = this._values$.asObservable();

  private current?: Map<AsyncVal<unknown>|number, ValueCell<unknown>>;

  update(values: AsyncOrSyncTuple<T>) {
    if (this.disposed) return;

    this.current?.forEach(x => x.reset());

    const newCells = new  Map<AsyncVal<unknown>|number, ValueCell<unknown>>();

    let i = 0;
    for (let value of values) {
      const [key, cell] = this.getCell(value, i++);
      newCells.set(key, cell);
    }

    this.current?.forEach(x => x.dispose());
    this.current = newCells;

    this.evaluate(newCells.values());

    this.current.forEach(c => c.onUpdate(() => this.evaluate(newCells.values())));
  }

  private getCell(value: AsyncOrSyncVal<unknown>, index: number): [number|AsyncVal<unknown>, ValueCell<unknown>] {
    if (value instanceof Promise) {
      return [value, this.handleAsync(value)];
    }

    if (value instanceof Observable || isSubscribable(value)) {
      return [value, this.handleAsync(value)];
    }

    return [index, this.handleSync(value)];
  }

  private handleAsync(val: AsyncVal<unknown>) {
    const oldCell = this.current?.get(val);
    if (oldCell) {
      this.current!.delete(val);
      return oldCell;
    }
    return new ValueCell(val);
  }

  private handleSync(val: unknown) {
    return new ValueCell(val);
  }

  protected abstract evaluate(cells: IterableIterator<ValueCell<unknown>>): void;

  protected setValue(value: T) {
    this._values$.next(value);
  }

  reset() {
    this.current?.forEach(x => x.dispose())
    this.current = undefined;
  }

  dispose() {
    this.disposed = true;
    this.reset();
  }
}

export class AsyncTupleFallbackMapper<T extends unknown[], TFallback> extends BaseAsyncTupleMapper<{[K in keyof T]: T[K]|TFallback}> {

  constructor(private fallback: TFallback) {
    super();
  }

  protected evaluate(cells: IterableIterator<ValueCell<unknown>>): void {
    const values: unknown[] = [];
    for (let cell of cells) {
      values.push(cell.hasValue ? cell.value! : this.fallback);
    }
    this.setValue(values as {[K in keyof T]: T[K]|TFallback});
  }

}

export class AsyncTupleMapper<T extends unknown[]> extends BaseAsyncTupleMapper<T> {

  constructor() {
    super();
  }

  protected evaluate(cells: IterableIterator<ValueCell<unknown>>): void {
    const values: unknown[] = [];

    for (let cell of cells) {
      if (!cell.hasValue) return;
      values.push(cell.value!);
    }

    this.setValue(values as T);
  }

}

class ValueCell<T> {
  private disposed = false;

  hasValue = false;
  value?: T;

  private sub?: Unsubscribable;
  private update$ = new Subject<void>();
  private updateSub = new Subscription();

  constructor(value: AsyncOrSyncVal<T>) {
    if (value instanceof Promise) {
      value = from(value);
    }

    if (value instanceof Observable || isSubscribable(value)) {
      this.sub = value.subscribe({
        next: x => this.setVal(x),
        error: () => this.setError()
      });
      return;
    }

    this.setVal(value);
  }

  private setVal(val: T) {
    this.value = val;
    this.hasValue = true;
    this.update$.next();
  }

  private setError() {
    this.value = undefined;
    this.hasValue = false;
    this.update$.next();
  }

  onUpdate(onUpdate: () => void) {
    if (this.disposed) return;

    this.updateSub.add(this.update$.subscribe(onUpdate));
  }

  reset() {
    this.updateSub.unsubscribe();
  }

  dispose() {
    this.disposed = true;
    this.reset();
    this.sub?.unsubscribe();
  }
}
