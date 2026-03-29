import { serviceRegistry } from '@/shared/serviceRegistry'
import { channel } from '@/shared/channel'
import { updaterService } from './updater-service'

export function registerMainServices(): void {
  serviceRegistry.implementService(channel, updaterService)
}
