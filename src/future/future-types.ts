/**
 * Future State indicating Loading
 * @category Future
 */
export class FutureLoading<T> {
  constructor(public value?: T) {
  }
}

/**
 * Future State indicating a Value
 * @category Future
 */
export class FutureValue<T> {
  constructor(public value: T) {
  }
}

/**
 * Future State indicating an Error
 * @category Future
 */
export class FutureError<T> {
  constructor(public error: Error, public value?: T) {
  }
}

/**
 * Future State indicating no value
 * @category Future
 */
export class FutureEmpty {
  constructor() { }
}

export type FutureUnion<T> = FutureLoading<T> | FutureError<T> | FutureValue<T> | FutureEmpty;
