const fastify = require('fastify')
const { asHex } = require('hexkey-utils')
const Hyperswarm = require('hyperswarm')
const Corestore = require('corestore')
const ram = require('random-access-memory')
const { decode } = require('hypercore-id-encoding')

async function setup ({ port, logger = true, timeoutS = 5, swarmArgs = {} } = {}) {
  const app = fastify({ logger })
  logger = app.log

  app.get('/probe', async function (req, res) {
    let key
    try {
      key = decode(req.query.target)
    } catch (e) {
      res.status(400)
      res.send('Invalid key')
      return
    }

    logger.info(`key ${asHex(key)}`)

    const store = new Corestore(ram)
    const core = store.get({ key })
    await core.ready()

    let firstConnectionMs
    const startMs = performance.now()

    const swarm = new Hyperswarm(swarmArgs)
    swarm.on('connection', (socket) => {
      firstConnectionMs = performance.now()
      store.replicate(socket)
      socket.on('error', e => logger.info(e)) // Usually just unexpectedly closed
    })

    swarm.join(core.discoveryKey)

    await core.update()
    let success = false
    try {
      const block = await core.get(0, { timeout: timeoutS * 1000 })
      if (block) success = true
    } catch (e) { } // Stay false
    const endMs = performance.now()
    const data = formatRes(success,
      { startMs, endMs, firstConnectionMs }
    )
    res.send(data)

    await swarm.destroy()
    logger.info('swarm closed')
    await store.close()
  })

  await app.listen({ port })

  return app
}

function formatRes (success, { startMs, endMs, firstConnectionMs = endMs }) {
  const firstConnectionS = (firstConnectionMs - startMs) / 1000
  const totalS = (endMs - startMs) / 1000

  const res = `
# HELP probe_first_swarm_connection_time_seconds Returns the time taken to connect to the first peer
# TYPE probe_first_swarm_connection_time_seconds gauge
probe_first_swarm_connection_time_seconds ${firstConnectionS}
# HELP probe_duration_seconds Returns how long the probe took to complete in seconds
# TYPE probe_duration_seconds gauge
probe_duration_seconds ${totalS}
# HELP probe_success Displays whether or not the probe was a success
# TYPE probe_success gauge
probe_success ${success ? 1 : 0}
`

  return res
}

module.exports = setup
