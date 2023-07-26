require('dotenv').config()
const goodbye = require('graceful-goodbye')
const pino = require('pino')

const setup = require('./index.js')

function loadConfig () {
  return {
    timeoutS: process.env.TIMEOUT_SEC || 5,
    port: parseInt(process.env.PORT || 21210),
    dhtPort: parseInt(process.env.DHT_PORT || 0),
    logLevel: process.env.LOG_LEVEL || 'info',
    host: process.env.HOST || '127.0.0.1',
    dhtHost: process.env.DHT_HOST || '0.0.0.0'
  }
}

async function main () {
  const config = loadConfig()
  const logger = pino({ level: config.logLevel })

  const app = await setup({ logger, ...config })

  goodbye(async () => {
    logger.info('Shutting down server')
    try {
      await app.close()
    } catch (e) {
      logger.error(`error while shutting down: ${e.stack}`)
    }
    logger.info('Shut down server')

    logger.info('Exiting program')
  })
}

main()
