const fastify = require('fastify')
const Hyperswarm = require('hyperswarm')
const Corestore = require('corestore')
const ram = require('random-access-memory')
const { decode } = require('hypercore-id-encoding')
const DHT = require('hyperdht')
const FIFO = require('fast-fifo')

async function setup ({ port, logger = true, timeoutS = 5, swarmArgs = {} } = {}) {
  const app = fastify({ logger })
  logger = app.log

  const dht = new DHT(swarmArgs)
  const store = new Corestore(ram)
  const swarm = new Hyperswarm({ dht })

  // We don't want to keep the sockets open forever,
  // as we are mostly interested in ensuring we can find
  // keys in the DHT
  const sTillDropConnection = timeoutS * 1000 * 2

  const timeouts = new FIFO()
  swarm.on('connection', (socket) => {
    store.replicate(socket)
    socket.on('error', e => logger.info(e)) // Usually just unexpectedly closed

    timeouts.push(setTimeout(
      () => {
        socket.destroy()
        timeouts.shift()
      }, sTillDropConnection
    ))
  })

  app.addHook('onClose', async () => {
    logger.info('Detroying the swarm')
    await swarm.destroy()

    // Clean up pending timeouts as they're no longer relevant (else we hang)
    while (!timeouts.isEmpty()) clearTimeout(timeouts.shift())

    await store.close()
    logger.info('Swarm destroyed')
  })

  app.get('/probe', async function (req, res) {
    let key
    try {
      key = decode(req.query.target)
    } catch (e) {
      res.status(400)
      res.send('Invalid key')
      return
    }

    const core = store.get({ key })
    await core.ready()

    const startMs = performance.now()
    swarm.join(core.discoveryKey, { server: false })

    let success = false
    try {
      const block = await core.get(0, { timeout: timeoutS * 1000 })
      logger.info('Got block')
      if (block) success = true
    } catch (e) { // Stay false
    } finally {
      // Clear up memory + ensure it needs downloading again if called multiple times
      await core.purge()
    }
    const endMs = performance.now()
    const data = formatRes(success,
      { logger, startMs, endMs }
    )
    res.send(data)
  })

  await app.listen({ port })

  return app
}

function formatRes (success, { logger, startMs, endMs }) {
  const totalS = (endMs - startMs) / 1000

  const res = `
# HELP hyper_probe_duration_seconds Returns how long the probe took to complete in seconds
# TYPE hyper_probe_duration_seconds gauge
hyper_probe_duration_seconds ${totalS}
# HELP hyper_probe_success Displays whether or not the probe was a success
# TYPE hyper_probe_success gauge
hyper_probe_success ${success ? 1 : 0}
`

  return res
}

module.exports = setup
