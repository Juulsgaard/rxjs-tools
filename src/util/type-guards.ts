import {Subscribable} from "rxjs";
import {isObject} from "@juulsgaard/ts-tools";

/**
 * Approximate if the argument is a Subscribable
 */
export function isSubscribable<T>(obj: unknown|Subscribable<T>): obj is Subscribable<T> {
  if (!obj) return false;
  if (!isObject(obj)) return false;
  return 'subscribe' in obj && typeof obj.subscribe === 'function';
}
