/** Data consists only of JSON values; freeze every nested array and object. */
export function freezeData<T>(value: T): T {
    if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
        for (const child of Object.values(value)) freezeData(child);
        Object.freeze(value);
    }
    return value;
}
