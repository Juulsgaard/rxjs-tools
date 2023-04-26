import {isBool, ListMapCache, MapFunc} from "@consensus-labs/ts-tools";
import {Observable, OperatorFunction, Subscribable, Unsubscribable} from "rxjs";
import {map} from "rxjs/operators";

/**
 * Map individual items in list
 * @param mapFunc - The function for mapping items
 */
export function mapList<T, TOut>(mapFunc: MapFunc<T, TOut>): OperatorFunction<T[], TOut[]> {
  return source => source.pipe(map(list => list.map(mapFunc)))
}

/**
 * Filter out list elements
 * @param filterFunc - The filter
 */
export function filterList<T>(filterFunc: MapFunc<T, boolean>): OperatorFunction<T[], T[]> {
  return source => source.pipe(map(list => list.filter(filterFunc)))
}

/**
 * Map individual items in list.
 * Mapped values are cached, and reused if items don't change between emissions
 * @param mapFunc - The function for mapping items (Should be pure for best result)
 * @param cache - Whether to use cache - default to true
 */
export function mapListChanged<TItem, TOut>(
  mapFunc: MapFunc<TItem, TOut>,
  cache: boolean|Subscribable<boolean> = true
): OperatorFunction<TItem[], TOut[]> {
  return source => new Observable(subscriber => {
    const mapCache = new ListMapCache<TItem, TOut>();

    let cacheSub: Unsubscribable|undefined;
    let useCache = true;

    if (isBool(cache)) {
      useCache = cache;
    } else {
      cacheSub = cache.subscribe({
        next: x => {
          if (useCache && !x) mapCache.clear();
          useCache = x;
        }
      });
    }

    const sub = source.subscribe({
      error: e => subscriber.error(e),
      complete: () => {
        mapCache.clear();
        subscriber.complete()
      },
      next: list => {
        subscriber.next(useCache ? mapCache.mapList(list, mapFunc) : list.map(mapFunc));
      }
    });

    return () => {
      sub.unsubscribe();
      cacheSub?.unsubscribe();
      mapCache.dispose();
    }
  });
}
