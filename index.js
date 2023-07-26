const fastify = require('fastify')
const Hyperswarm = require('hyperswarm')
const Corestore = require('corestore')
const ram = require('random-access-memory')
const { decode } = require('hypercore-id-encoding')
const DHT = require('hyperdht')
const { asHex } = require('hexkey-utils')

async function setup ({ port, logger = true, timeoutS = 5, swarmArgs = {} } = {}) {
  const app = fastify({ logger })
  logger = app.log

  const dht = new DHT(swarmArgs)
  const store = new Corestore(ram)
  const swarm = new Hyperswarm({ dht })
  const cores = new Map()

  swarm.on('connection', (socket, peerInfo) => {
    const peerKey = asHex(peerInfo.publicKey)
    logger.info(`connected to peer ${peerKey} (total: ${swarm.connections.size})`)
    store.replicate(socket)
    socket.on('error', e => logger.info(e)) // Usually just unexpectedly closed
    socket.on('close', () => logger.info(`closed connection to ${peerKey} (total: ${swarm.connections.size})`))
  })

  app.addHook('onClose', async () => {
    logger.info('Cleaning up the swarm and corestore')
    await swarm.destroy()
    await store.close()
    logger.info('Swarm and corestore destroyed')
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

    const core = getSessionOn(key)
    try {
      await core.ready()

      const startMs = performance.now()
      swarm.join(core.discoveryKey, { server: false })

      let success = false
      try {
        const block = await core.get(0, { timeout: timeoutS * 1000 })
        if (block) success = true
      } catch (e) { // Stay false
      } finally {
        // Clear up memory + ensure it needs downloading again if called again
        await core.clear(0)
      }
      const endMs = performance.now()
      const totalS = (endMs - startMs) / 1000

      const nrPeers = core.peers.length

      const data = getMetrics({ success, totalS, nrPeers })
      res.send(data)
    } finally {
      await core.close()
    }
  })

  function getSessionOn (bufKey) {
    // Note: a core is currently never removed from the map
    const normKey = asHex(bufKey)
    const existingCore = cores.get(normKey)
    if (existingCore) return existingCore.session()

    const core = store.get({ key: bufKey })
    cores.set(normKey, core)
    return core.session()
  }

  await app.listen({ port })

  return app
}

function getMetrics ({ success, totalS, nrPeers }) {
  return `
# HELP hyper_probe_duration_seconds Returns how long the probe took to complete in seconds
# TYPE hyper_probe_duration_seconds gauge
hyper_probe_duration_seconds ${totalS}
# HELP hyper_probe_success Displays whether or not the probe was a success
# TYPE hyper_probe_success gauge
hyper_probe_success ${success ? 1 : 0}
# HELP hyper_probe_nr_peers Displays the number of peers who are serving this core
# TYPE hyper_probe_nr_peers gauge
hyper_probe_nr_peers ${nrPeers}
`
}

module.exports = setup
