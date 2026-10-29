/** Strip the `via` provenance from locations so span-only assertions stay focused. */
export const bare = (locations) => locations.map(({ via, ...rest }) => rest);
