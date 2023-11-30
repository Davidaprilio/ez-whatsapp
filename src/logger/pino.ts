import Pino, { Logger } from 'pino'

// Create a stream where the logs will be written
const PinoLog: Logger = Pino({ name: 'project' })

export default PinoLog
// Writing some test logs
// log.warn('WARNING 1')
// log.error('ERROR 1')
// log.fatal('FATAL 1')