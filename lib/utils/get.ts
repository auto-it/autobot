export function get<O, T>(obj: O, unsafeDataOperation: (x: O) => T, valueIfFailOrUndefined: T): T {
  try {
    const result = unsafeDataOperation(obj);
    if (result !== undefined) {
      return result;
    } else {
      throw new Error();
    }
  } catch (error) {
    return valueIfFailOrUndefined;
  }
}
