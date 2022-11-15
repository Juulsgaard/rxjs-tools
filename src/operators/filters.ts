import {OperatorFunction} from "rxjs";
import {filter} from "rxjs/operators";

export function notNull<T>(): OperatorFunction<T, NonNullable<T>> {
  return source => source.pipe(filter((value): value is NonNullable<T> => value != undefined));
}
