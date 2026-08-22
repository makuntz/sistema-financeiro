import Constants, { ExecutionEnvironment } from 'expo-constants';

/** Expo Go does not include custom native modules (e.g. ML Kit). Requires Development Build. */
export function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

export function isDevClient(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.Bare;
}
