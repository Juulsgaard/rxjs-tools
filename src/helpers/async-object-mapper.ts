import {Disposable} from "@juulsgaard/ts-tools";
import {from, Observable, Subject, Subscription, Unsubscribable} from "rxjs";
import {AsyncOrSyncVal, AsyncVal, UnwrappedAsyncOrSyncVal, UnwrappedAsyncVal} from "./async-value-mapper";
import {isSubscribable} from "../util/type-guards";

export type AsAsyncObject<T extends Record<string, unknown>> = {[K in keyof T]: AsyncVal<T[K]>};
export type AsyncObject = Record<string, AsyncVal<unknown>>;
export type AsAsyncOrSyncObject<T extends Record<string, unknown>> = {[K in keyof T]: AsyncOrSyncVal<T[K]>};
export type AsyncOrSyncObject = Record<string, AsyncOrSyncVal<unknown>>;
export type UnwrappedAsyncObject<T extends AsyncObject, TMod = never> = {[K in keyof T]: UnwrappedAsyncVal<T[K], TMod>};
export type UnwrappedAsyncOrSyncObject<T extends AsyncOrSyncObject, TMod = never> = {[K in keyof T]: UnwrappedAsyncOrSyncVal<T[K], TMod>};

abstract class BaseAsyncObjectMapper<T extends Record<string, unknown>> implements Disposable {

  private disposed = false;

  private readonly _values$ = new Subject<T>();
  public readonly values$ = this._values$.asObservable();

  private current?: Map<AsyncVal<unknown>|string, ValueCell<unknown>>;

  update(values: AsAsyncOrSyncObject<T>): boolean {
    if (this.disposed) return false;

    this.current?.forEach(x => x.reset());

    const newCells = new  Map<AsyncVal<unknown>|string, ValueCell<unknown>>();

    for (let prop in values) {
      const value = values[prop];
      const [key, cell] = this.getCell(value, prop);
      newCells.set(key, cell);
    }

    this.current?.forEach(x => x.dispose());
    this.current = newCells;

    const emitted = this.evaluate(newCells.values());

    this.current.forEach(c => c.onUpdate(() => this.evaluate(newCells.values())));

    return emitted;
  }

  private getCell(value: AsyncOrSyncVal<unknown>, prop: string): [string|AsyncVal<unknown>, ValueCell<unknown>] {
    if (value instanceof Promise) {
      return [value, this.handleAsync(value, prop)];
    }

    if (value instanceof Observable || isSubscribable(value)) {
      return [value, this.handleAsync(value, prop)];
    }

    return [prop, this.handleSync(value, prop)];
  }

  private handleAsync(val: AsyncVal<unknown>, prop: string) {
    const oldCell = this.current?.get(val);
    if (oldCell) {
      oldCell.prop = prop;
      this.current!.delete(val);
      return oldCell;
    }
    return new ValueCell(val, prop);
  }

  private handleSync(val: unknown, prop: string) {
    return new ValueCell(val, prop);
  }

  /**
   * Extract value from cells
   * @param cells
   * @protected
   * @returns emitted - True if a value was emitted
   */
  protected abstract evaluate(cells: IterableIterator<ValueCell<unknown>>): boolean;

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

export class AsyncObjectFallbackMapper<T extends Record<string, unknown>, TFallback> extends BaseAsyncObjectMapper<{[K in keyof T]: T[K]|TFallback}> {

  constructor(private fallback: TFallback) {
    super();
  }

  protected evaluate(cells: IterableIterator<ValueCell<unknown>>): boolean {
    const values: Record<string, unknown> = {};

    for (let cell of cells) {
      values[cell.prop] = cell.hasValue ? cell.value! : this.fallback;
    }

    this.setValue(values as {[K in keyof T]: T[K]|TFallback});
    return true;
  }

}

export class AsyncObjectMapper<T extends Record<string, unknown>> extends BaseAsyncObjectMapper<T> {

  constructor() {
    super();
  }

  protected evaluate(cells: IterableIterator<ValueCell<unknown>>): boolean {
    const values: Record<string, unknown> = {};

    for (let cell of cells) {
      if (!cell.hasValue) return false;
      values[cell.prop] = cell.value!;
    }

    this.setValue(values as T);
    return true;
  }

}

class ValueCell<T> {
  private disposed = false;

  hasValue = false;
  value?: T;

  private sub?: Unsubscribable;
  private update$ = new Subject<void>();
  private updateSub = new Subscription();

  constructor(value: AsyncOrSyncVal<T>, public prop: string) {
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
