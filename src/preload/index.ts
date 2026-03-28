import { channel } from '@/shared/channel'
import { log } from '@/utils/log'

channel.init()

log.info('preload init')

// Test all new log methods
log.verbose('preload verbose test')
log.silly('preload silly test')
log.log('preload log test')

//  log test
log.info('1', 1)
log.info('2', undefined)
log.info('3', null)
log.info('4', function a() {})
log.info('5', () => {})
log.info('6', { a: 'aaa', b: 'bb' })
log.info('7', 'sss')
log.info('8', String('sss'))
log.info('9', new Error('sss'))
