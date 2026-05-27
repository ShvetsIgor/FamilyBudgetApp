const STORE_GROUP_TO_FOLDER_ID: Record<string, string> = {
  supermarket: 'food',
  fast_food: 'dining',
  coffee: 'dining',
  delivery: 'dining',
  pharmacy: 'health',
  taxi: 'transport',
  fuel_station: 'car',
  fashion: 'shopping',
  online_retail: 'shopping',
  electronics_store: 'technology',
  furniture_store: 'home',
  home_improvement: 'home',
  streaming: 'subscriptions',
  cloud: 'subscriptions',
  software: 'technology',
  internet_provider: 'home',
  mobile_carrier: 'home',
  accommodation: 'travel',
  airline: 'travel',
};

export function getStoreGroupFolderId(storeGroup?: string): string | undefined {
  return storeGroup ? STORE_GROUP_TO_FOLDER_ID[storeGroup] : undefined;
}
