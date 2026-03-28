import { serviceRegistry } from '@/shared/serviceRegistry'
import { viewManager } from '@/main/view-manager'
import { updaterService } from './updater-service'

export function registerMainServices(): void {
  serviceRegistry.implementService(viewManager, updaterService)
}
