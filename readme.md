# :warning: Active development. Unstable. Breaking Changes. You get the point.

A javascript module for exploring lotus running locally on your machine. See the [Lotus docs](https://docs.lotu.sh/) for more information.

`npm i @openworklabs/lotus-block-explorer`<br />

```js
const lotus = new Lotus({ token: '<your-jwt-token>' })

await lotus.explore()
console.log(lotus.getChain()) // prints the chain fromHeight <> toHeight

const actors = await lotus.listActors()
console.log(actors) // prints all the actors along with their nonce, balance, and types
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

If you're running this package in the browser, you will need to figure out a way to get around cors. The easiest way is to configure your own proxy server around Lotus, and explicitly handle preflight `options` requests via the proxy server.