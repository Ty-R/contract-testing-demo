const { Verifier } = require('@pact-foundation/pact')
const app = require('../app');

const server = app.listen(3001);

const options = {
  provider: 'storage-service',
  providerBaseUrl: 'http://localhost:3001',
  pactBrokerUrl: 'http://localhost:9292',
  providerVersion: '0.0.1',
  publishVerificationResult: true
}

if (process.env.PACT_PAYLOAD_URL) {
  options.pactUrls = [process.env.PACT_PAYLOAD_URL]
} else {
  options.consumerVersionSelectors = [
    { mainBranch: true },
    { latest: true }
  ]
}

const verifier = new Verifier(options)

describe('Pact verification', () => {
  it('validates the pacts', () => {
    return verifier.verifyProvider().then((output) => {
      console.log('verification complete')
      console.log(output)
    }).finally(() => {
      server.close()
    })
  })
})