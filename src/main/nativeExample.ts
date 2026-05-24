import { greet } from 'native';
import { logger } from '@/utils/log';

export function nativeExample() {
  const message = greet('World');
  logger('native').info(message);
  return message;
}
