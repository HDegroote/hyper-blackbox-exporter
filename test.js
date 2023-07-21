const test = require('brittle')
const setup = require('./index')
const axios = require('axios')
const Hyperswarm = require('hyperswarm')
const Corestore = require('corestore')
const RAM = require('random-access-memory')
const createTestnet = require('@hyperswarm/testnet')
const b4a = require('b4a')

async function getFixtures (t) {
  const testnet = await createTestnet(3)
  const bootstrap = testnet.bootstrap
  const swarm = new Hyperswarm(testnet)
  const store = new Corestore(RAM)
  swarm.on('connection', (socket) => {
    store.replicate(socket)
    socket.on('error', e => {})
  })

  const core = store.get({ name: 'mycore' })
  await core.append('Block 0')
  swarm.join(core.discoveryKey, { server: true })
  await swarm.flush()

  const app = await setup({ logger: false, timeoutS: 1, swarmArgs: { bootstrap } })
  t.teardown(async () => {
    await app.close()
    await swarm.destroy()
    await store.close()
    await testnet.destroy()
  })

  const url = `http://localhost:${app.server.address().port}/probe/`

  return { swarm, app, core, url }
}

test('probe_success 1 for reachable key', async t => {
  const { core, url } = await getFixtures(t)

  const key = b4a.toString(core.key, 'hex') // '7d2050aa131f1d0dad47723c3ac0a4af2dd087d4269848c9909c6b28c2463b34' // 'a'.repeat(64)
  const res = await axios.get(`${url}${key}`, { validateStatus: null })
  t.is(res.status, 200)
  t.ok(res.data.includes('probe_success 1'))
  t.not(res.data.includes('probe_success 0'))
})

test('probe_status 0 for unreachable key', async t => {
  const { url } = await getFixtures(t)

  const key = 'a'.repeat(64)
  const res = await axios.get(`${url}${key}`, { validateStatus: null })
  t.is(res.status, 200)
  t.ok(res.data.includes('probe_success 0'))
  t.not(res.data.includes('probe_success 1'))
})

test('400 status on invalid key', async t => {
  const { url } = await getFixtures(t)

  const key = 'nope'
  const res = await axios.get(`${url}${key}`, { validateStatus: null })
  t.is(res.status, 400)
})
