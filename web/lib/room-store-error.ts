export class RoomStoreError extends Error {
  readonly status: 400 | 401 | 409 | 500;

  constructor(message: string, status: 400 | 401 | 409 | 500) {
    super(message);
    this.name = "RoomStoreError";
    this.status = status;
  }
}
