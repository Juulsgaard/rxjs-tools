
export class CancelledError extends Error {
  constructor(message?: string) {
    super(message ?? 'Cancelled');
  }
}
