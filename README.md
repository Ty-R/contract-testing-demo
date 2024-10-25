# Contract Testing Demo with Pact

This is a test project for demonstrating consumer-driven contract testing with Pact. It features two very basic services and a Pact broker.

Everything in this project is offline, and can easily be reset, so please feel free to clone and tinker. Alternatively, follow this README for a walkthrough of the project and contract testing with Pact generally.

* [What is Contract Testing?](#what-is-contract-testing)
* [Project Overview](#project-overview)
* [Prerequisites](#prerequisites)
* [Getting Started](#getting-started)
* [The Contract Tests](#the-contract-tests)
    * [Consumer Test](#consumer-test)
    * [Provider Test](#provider-test)
* [Contract Violations](#contract-violations)
    * [Provider Side](#project-overview)
    * [Consumer Side](#consumer-side)
* [Compatibility Matrix](#compatibility-matrix)
* [Resetting](#resetting)

## What is Contract Testing?

In short, contract testing ensures two services can communicate with each other by forcing them to agree on the content and format of the data they exchange. This is achieved, with Pact, by establishing a feedback loop between a consumer service and provider service with a contract management service in the middle:

<p align="center">
  <img src="https://github.com/user-attachments/assets/e36a2512-e1f0-4784-aa8f-3ff9488a906e" width="500" >
</p>

Consumer teams define expected interactions (e.g. the requests they expect to be able to make, and responses they expect to get back). During this process, they verify their side of the contract (request), then publish the contract to the broker for provider verification (response).

## Project Overview

This demo consists of two services:

1. **API Service (Consumer)**: A simple API that makes requests to the Storage Service
2. **Storage Service (Provider)**: A service that manages item data

In this demo, we'll walk through how to use Pact to define and verify interactions between these services, how the Pact Broker manages contracts and verification results, and how to use this data to facilitate deployment.

## Prerequisites

- Node.js
- Docker and Docker Compose
- Basic understanding of JavaScript and Express.js

## Getting Started

1. Clone this repository
2. Install dependencies: `npm install`
3. Start the Pact Broker: `docker-compose up -d`

## The contract Tests

A contract test is generally made up of two parts:
* The consumer test
* The provider test

### Consumer Test

A consumer test, such as `./api/tests/storage-service.contract.test.js`, outlines an expected interaction between the consumer and provider, and verifies the consumer's implementation of that interaction.

Run the consumer's test with: `npm run pact:generate`.

This will pass, and generate a JSON representation of the interaction under a newly created `pacts/` directory. At this stage, the consumer's implementation is verified, but we need to make this pact available to the provider for full verification; this is done by publishing the pact to the broker: `npm run pact:publish`.

Once published, feel free to explore the [broker UI](http://localhost:9292).

### Provider Test

A provider test, such as `./storage-service/tests/provider.test.js`, fetches consumer pacts from the broker, and "replays" the contents against a local instance of that provider. If the provider's response is not per the consumer's expectation, the test will fail.

Run the provider's test with: `npm run pact:verify`.

This will pass, and the result will be sent back to the broker.

## Contract Violations

This test approach is primarily about exposing misunderstandings between a consumer and provider in the ways they interact. A misunderstanding can come in many forms, such as:

* Requests to invalid routes
* Missing a required request field
* Missing a depended-on response field
* Exchange of invalid values (e.g. an enum value) or data types

### Provider-Side

If we take a look at the consumer's test for `GET /storage/item/:id`, we can see it explicitly expects the response to contain `id`, `name,` and `description`. Let's change the provider's source to not return one of these.

```diff
# ./storage-service/app.js#L18
- description: item.description
```

Then run: `npm run pact:verify`.

Note that the test fails even though all we updated was the source. No mocks needed to be changed, and no test data needed to be updated.

Revert the change and re-run the test.

### Consumer-Side

Remember, a consumer test involves outlining an expected interaction, and verifying the consumer's implementation of that interaction. This means the consumer test itself can only fail if the consumer's implementation is not per the contract test's expectation.

Let's change the consumer's source to make a request to the wrong route:

```diff
# ./api/app.js#L24
- return axios.post(`${storageServiceUrl}/storage/item`, req.body)
+ return axios.post(`${storageServiceUrl}/storage/items`, req.body)
```

Then run: `npm run pact:generate`.

This will fail because the contract test is expecting a request to `/storage/item`, but the consumer is actually making a request to `/storage/items`. A pact file will not be generated.

Let's update the contract test to expect this route:

```diff
# ./api/tests/storage-service.contract.test.js#L45
- path: '/storage/item',
+ path: '/storage/items'
```

Then run: `npm run pact:generate`.

This will now pass because the implementation and expectation are in line. Following this, we want to generate, publish, and verify the change:

```sh
npm run pact:generate
npm run pact:publish
npm run pact:verify
```

The verification will fail because the provider returns a `404`; it does not recognise this route.

Revert the changes, and re-run the pact commands above.

## Compatibility Matrix

In a fully integrated CI/CD pipeline, every commit would result in a new contract version (consumer-side) or a new version verification (provider-side). Over time, this builds up a compatibility matrix that we can query to find out which service versions (commits) are compatible.

Throughout this walkthrough, we've been publishing and verifying contracts; this is all visible the broker UI's [compatibility matrix](http://localhost:9292/matrix?q%5B%5Dpacticipant=api&q%5B%5Dpacticipant=storage-service&latest=&mainBranch=&latestby=&limit=100).

### Deployability

Extending the compatibility matrix, we can also tell the broker about the existence of an environment (e.g staging, production), and tell it which services are on which environment. This will build up to a useful deployment tool that can be queried for whether it is safe to deploy, or roll back, a particular service based on historic verification results with services already marked as deployed.

It is highly recommended to check out the docs for [can-i-deploy](https://docs.pact.io/pact_broker/can_i_deploy), but we can briefly explore this in practice.

### Create an Environment

We need to tell the broker about the existence of an environment:

```sh
npx pact-broker create-environment --name staging --display-name Staging --no-production --broker-base-url "http://localhost:9292"
```

### Record Deployment

We then need to associate a contract version with the environment. This is normally a task for a deploy pipeline, but we'll do it manually for the sake of this example:

```sh
npx pact-broker record-deployment --pacticipant storage-service --version 0.0.1 --environment staging --broker-base-url "http://localhost:9292"
```

With the storage service marked as "deployed", we can use a tool called `can-i-deploy` to ask the broker whether it'd be safe to also deploy the API:

```sh
npx pact-broker can-i-deploy --pacticipant api --branch test-demo --to-environment staging --broker-base-url "http://localhost:9292"
```

The result of this is essentially the last known verification result between the API and any of it's dependents that are currently marked as deployed.

## Automation

Everything so far in this walkthrough has been largely a manual effort, but this feedback loop can and definitely should be automated.

Ideally, we would integrate this tightly with existing pipelines:
* Contract tests would be run alongside unit and integration tests
* The publishing of contracts would be a step that follows the tests themselves
* The awaiting of verification should be a step that follows the publishing

"Waiting for verification" typically leans on the earlier-mentioned `can-i-deploy` utility, but this subject can get relatively complex, and it depends on existing development practices and delivery strategies within a company. We may not want pipelines to fail for in-flight changes because there's no intention to actually deploy them yet, or we want to ensure that everything merged must be safe to deploy at any time. It's definitely worth reading an article on Pact's site regarding "[work in progress pacts](https://docs.pact.io/pact_broker/advanced_topics/wip_pacts)".

## Want More?

The walkthrough has kept things relatively simple, but feel free to make any changes on either side to get more familiar with Pact.

Right now, there are only two basic contract tests covering two interactions, but there are more untested interactions in this project:
* Updating an item
* Deleting an item
* Getting all items

Feel free to create tests for these too, both positive and negative.

## Resetting

If at any point you weant to reset the broker and the code, simply:

1. Stop the broker, and run: `docker-compose down`
2. Reset the broker: `docker volume rm contract-testing-demo_postgres-volume`
3. Reset **ALL** code changes: `git checkout -- .`
