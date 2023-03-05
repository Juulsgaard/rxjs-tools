import {
  combineLatest, from, Observable, ObservableInput, ObservableInputTuple, of, OperatorFunction, ReplaySubject,
  Subscription, take, Unsubscribable
} from "rxjs";

/**
 * Include the first value of all inputs.
 * Will use a cached value from the inputs if one has been emitted,
 * otherwise the main observable will be delayed until one is emitted on all inputs.
 * @param inputs - The inputs to include
 */
export function withFirstFrom<T, O extends unknown[]>(
  ...inputs: [...ObservableInputTuple<O>]
): OperatorFunction<T, [T, ...O]> {
  return source => new Observable<[T, ...O]>(subscriber => {

    const values = inputs.map(x => new CachedValue(x));
    const valueSubs = new Subscription();

    const sub = source.subscribe({
      error: err => subscriber.error(err),
      complete: () => subscriber.complete(),
      next: value => {
        const firstValues = values.map(x => x.first$) as ObservableInputTuple<O>;

        valueSubs.add(
          combineLatest<[T, ...O]>([of(value), ...firstValues])
            .subscribe({
              error: err => subscriber.error(err),
              next: value => subscriber.next(value)
            })
        );
      }
    });

    // Cleanup
    return () => {
      sub.unsubscribe();
      valueSubs.unsubscribe();
      values.forEach(x => x.unsubscribe());
    }
  });
}

class CachedValue<T> implements Unsubscribable {
  private _value$ = new ReplaySubject<T>();
  private sub: Subscription;

  get first$() {
    return this._value$.pipe(take(1))
  }

  constructor(input: ObservableInput<T>) {
    this.sub = from(input).subscribe(this._value$);
  }

  unsubscribe(): void {
    this.sub.unsubscribe();
  }
}
