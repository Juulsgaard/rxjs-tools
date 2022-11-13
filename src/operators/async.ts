import {concatMap, from, MonoTypeOperatorFunction, Observable, OperatorFunction} from "rxjs";
import {filter, map} from "rxjs/operators";

export function filterAsync<T>(filterFunc: (value: T) => Promise<boolean>): MonoTypeOperatorFunction<T> {
  return (source) => {
    return source.pipe(
      concatMap(val => from(filterFunc(val)).pipe(
        filter(x => x),
        map(() => val)
      ))
    );
  }
}

export function mapAsync<T, TOut>(mapFunc: (value: T) => Promise<TOut>): OperatorFunction<T, TOut> {
  return (source) => {
    return source.pipe(
      concatMap(val => from(mapFunc(val)))
    );
  }
}
