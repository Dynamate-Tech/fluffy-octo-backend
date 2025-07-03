import { fetchAllVariantsByTag, fetchAllVariantsByCollection } from './shopifyVariantHelpers.js';

export async function getVariantsToUpdate(filterType, filterValue) {
  if (filterType === 'tag') {
    return await fetchAllVariantsByTag(filterValue);
  } else if (filterType === 'collection') {
    return await fetchAllVariantsByCollection(filterValue);
  } else {
    throw new Error('Unknown filter type');
  }
}
