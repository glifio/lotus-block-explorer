# :warning: Active development. Unstable. Breaking Changes. You get the point.

A javascript module for exploring lotus running locally on your machine. See the [Lotus docs](https://docs.lotu.sh/) for more information.

`npm i @openworklabs/lotus-block-explorer`<br />

## Basic exploration

```js
const lotus = new Lotus({ token: '<your-jwt-token>' })

const chainUpdateCallback = chainState => {
  // will log the updated chain state any time new blocks are explored
  console.log(chainState)
}

// subscribe to chain updates
lotus.store.subscribe(chainUpdateCallback)

// start exploring Lotus heights
await lotus.explore({ toHeight: 'latest', fromHeight: '0' })

// get the current chain state
const currentChainState = lotus.store.getState()

// when you're done, stop listening for updates
lotus.store.unsubscribe(chainUpdateCallback)
```

## Chain Listening

```js
const lotus = new Lotus({ token: '<your-jwt-token>' })

const chainUpdateCallback = chainState => {
  // will log the updated chain state any time new blocks are explored
  console.log(chainState)
}

// subscribe to chain updates
lotus.store.subscribe(chainUpdateCallback)

// poll lotus for new tipsets to add to the in-memory chain store
lotus.listen()

// cancel listeners
lotus.stopListening()
lotus.store.unsubscribe(chainUpdateCallback)
```

### Constructor options

```js
{
  jsonrpcEndpoint: <String> (defaults to 'http://127.0.0.1:1234/rpc/v0')
  token: <String> (jwt token see [here](https://docs.lotu.sh/en+api-scripting-support))
}
```

### explore options

```js
await lotus.explore({
  fromHeight: (<String> || <Number>),
  toHeight: (<String> || <Number>) // defaults to the current ChainHead
})
```

### CORS

If you're running this package in a [Create React App](https://create-react-app.dev/), for development purposes you can proxy api requests. [More info](https://create-react-app.dev/docs/proxying-api-requests-in-development/). When it comes to production or other browser use cases, you will need to set Lotus behind a proxy like [NGNIX](https://www.nginx.com/). Here is a sample docker container: https://github.com/RTradeLtd/lotus-infra
