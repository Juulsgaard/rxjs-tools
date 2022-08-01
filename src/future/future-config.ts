import {Observable} from "rxjs";
import {distinctUntilChanged, map} from "rxjs/operators";
import {Future} from "./future";

export class FutureConfig<T, TOut> {

  private onLoad?: () => void;
  private onDeleted?: () => void;

  constructor(
    private value$: Observable<T>,
    private loading$: Observable<boolean>,
    private error$: Observable<Error | boolean | string | undefined>,
    private mapper: (value: T) => NonNullable<TOut> | undefined
  ) {
  }

  withMapper<TNew>(map: (value: NonNullable<T>) => TNew): FutureConfig<T, TNew> {
    return new FutureConfig<T, TNew>(this.value$, this.loading$, this.error$, x => x != undefined ? map(x!) ?? undefined : undefined);
  }

  withLoadCall(onLoad: () => void): this {
    this.onLoad = onLoad;
    return this;
  }

  withDeleteCall(onDelete: () => void): this {
    this.onDeleted = onDelete;
    return this;
  }

  generate(): Future<NonNullable<TOut>> {

    // Pre-map value future for better change detection
    const value$ = this.value$.pipe(
      distinctUntilChanged(),
      map(x => this.mapper(x))
    );

    return new Future<NonNullable<TOut>>(value$, this.loading$, this.error$, this.onLoad, this.onDeleted);
  }
}
