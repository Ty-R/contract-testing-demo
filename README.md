# Contract Testing Example

This is a test project for demonstrating consumer-driven contract testing with Pact. It features two very basic services and a Pact broker.

Everything in this project is offline, and can easily be reset, so please feel free to clone and tinker. Alternatively, follow this README for a walkthrough of the project and contract testing with Pact generally.

* [Background and Setup](#background-and-setup)
* [The Pact Broker](#the-pact-broker)
* [Consumer Test](#consumer-test)
* [Provider Test](#provider-test)
* [Breaking Changes](#breaking-changes)
    * [Provider](#provider)
    * [Consumer](#consumer)
* [Deployability](#deployability)
    * [Create an Environment](#create-an-environment)
    * [Record Deployment](#record-deployment)
    * [Compatibility Matrix](#compatibility-matrix)
* [Automation](#automation)
* [Resetting](#resetting)

## Background and Setup

This project has two services - an API (the consumer) and an storage service (the provider). The storage service supports all CRUD operations, and can be called through the API; this project aims to write contract tests to test these interactions.

> [!NOTE]
> Docker and Node are required. All commands are expected to be run from the project root.

To set things up, we wfirst want to install dependencies which can be done by running: `npm install`

## The Pact Broker

The Pact broker is a middleman contract-management service that is central to the contract testing feedback loop:
* Consumers `POST` contracts and `GET` verification results
* Providers `GET` contracts and `POST` verification results

To start the broker in this project, simply run: `docker-compose up` from the project root, and visit http://localhost:9292. If following along, leave the broker running for the rest of this walkthrough.

## Consumer Test

In consumer-driven contract testing, the consumer is responsible for defining expected interactions (e.g. the requests it expects to be able to make, and responses it expects to get back). These expectations are defined as part of the consumer's contract test file, such as the one under `./api/tests`.

Within this test file is going to be explicit definitions of expected interactions. Following the definition, the consumer test is going to verify the consumer's side of the contract (the request). This is to ensure accuracy of the resulting contract, to prevent GIGO.

To run the consumer test, simply run: `npm run pact:generate`.

This test will pass, and a `pacts/` directory will be created. Within this new directory will be a pact file containing a JSON respresentation of the interactions under test, made up of already-verified requests, and yet to be verified responses.

With the pact file generated, we want to publish it to the broker for full verification which can be done by running: `npm run pact:publish`. Once published, reload the broker UI and it should appear.

## Provider Test

A provider test involves verifying it can meet the expectations of consumer interactions. It does this by pulling down pact files from the broker, and replaying the contents against a local instance of that provider. If the expected responses match the actual responses, then the verification passes, otherwise it'll be marked as failed.

To run the provider's test, simply run: `npm run pact:verify`.

This test will pass, and the result will be sent back to the broker -- reload the UI and we should be able to see this.

## Breaking Changes

This test approach is focused on guarding against contract violations which can come in many forms, such as whether a provider understands a request, and whether it response per consumer's expectation. For example:
* A provider team may remove a response field they thought was unused, but is actually still depended on by one or more consumers
* A consumer team may accidently send an invalid enum value in a request

Let's make some breaking changes to both sides and get a feel for the feedback Pact provides.

### Provider

If we take a look at the consumer's test for `GET /storage/item/:id`, we can see it explicitly expects the response to contain `id`, `name,` and `description`.

With that in mind, let's modify the provider's response in a way that will certainly break the expectation:

```diff
# ./storage-service/app.js#L18
- description: item.description
```

After that, run: `npm run pact:verify`.

Note that the test fails even though all we updated was the source. No mocks needed to be changed, no test data needed to be updated. If we take a look in the UI, we can see the result in there too.

Revert the change and re-run the test.

### Consumer

A violation from this perspective is either going to be a misunderstanding of how a provider is expected to be used, or a response expectation that is not inline with the provider's actual response.

Let's introduce a mistake on the consumer side by changing the endpoint it calls to update an item.

```diff
# ./api/app.js#L24
- return axios.post(`${storageServiceUrl}/storage/item`, req.body)
+ return axios.post(`${storageServiceUrl}/storage/items`, req.body)
```

```diff
# ./api/tests/consumer.test.js#L45
- path: '/storage/item',
+ path: '/storage/items'
```

This may seem like an unlikely scenario, but it's purely for demonstration!

Following that, we want to generate, publish, and verify the change:

```sh
npm run pact:generate
npm run pact:publish
npm run pact:verify
```

The verification will fail because the provider returns a `404`.

Revert the changes, and re-run the pact commands above.

## Deployability

The examples in earlier sections have largely been comparing latest changes, but the broker is keeping a history of contracts, versions, and verifications. A new contract is published and verified on every consumer change.

To reduce versioning overhead, it is common to version the contracts and verifications by commit SHA, for example - consumer commit `123` was verified by provider commit `456`. Over time, we end up with a "compatibility matrix" that we can query against to find out which service versions are compatible.

On top of this, the Pact Broker can also be told about environments, and we can associate a contract version with an environment.

This builds up to the ability to query the broker for whether it is safe to deploy a particular version of a service to an environment based on historic verifications between that service's version and the ones that are already associated with that environment.

It's simpler than it sounds, so let's explore this to get a better idea.

### Create an Environment

We need to tell the broker about the existence of an environment:

```sh
npx pact-broker create-environment --name staging --display-name Staging --no-production --broker-base-url "http://localhost:9292"
```

### Record Deployment

We then need to associate a contract version with the environment. This is normally a task for a deploy pipeline, but we'll do it manually for the sake of this example:

```sh
npx pact-broker record-deployment --pacticipant auth --version 0.0.1 --environment staging --broker-base-url "http://localhost:9292"
```

### Compatibility Matrix

If you've been following along, the broker will already have multiple contracts and verifications. [Check out the UI](http://localhost:9292/matrix?q%5B%5Dpacticipant=api&q%5B%5Dpacticipant=storage-service&latest=&mainBranch=&latestby=&limit=100)

It will contain a list of compatibilities showing which versions are safe to deploy together based on the verification result. This may seem unimpressive given the small sample size but when fully integrated, it'd show all commits across branches and environments; this can make it a powerful deployment tool.

We can programatically query this data using a utility called `can-i-deploy`, such as:

```sh
npx pact-broker can-i-deploy --pacticipant api --branch test-demo --to-environment staging --broker-base-url "http://localhost:9292"
```

## Automation

Everything so far has been largely a manual effort, but this feedback loop can and should be automated.

Ideally, we would integrate this tightly with existing pipelines - contract tests would be run alongside unit and integration tests, followed by a step that publishes the contract and waits for verification.

We'd be aiming for two asyncronous workflows:

| On consumer commit  | On provider commit |
| ------------- | ------------- |
| Generate and publish a new contract reflecting that consumer's commit. Once published, it will await the verification of that contract. A webhook in the broker will be setup to call upon a provider's pipeline on publish of a new consumer contract | Fetch existing consumer contracts from the broker and ensure it can still meet the expectations within them, publishing the results of a verification back to the broker  |

## Resetting

If at any point you weant to reset the broker and the code, simply:

1. Stop the broker, and run: `docker-compose down`
2. Delete the volume: `docker volume rm contract-testing-demo_postgres-volume`
3. Reset code changes: `git checkout -- .`
