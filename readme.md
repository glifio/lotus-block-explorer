# :warning: Active development. Unstable. Breaking Changes. You get the point.

A javascript module for exploring lotus running locally on your machine:

`npm i @openworklabs/lotus-block-explorer`<br />

```js
const lotus = new Lotus()

await lotus.explore()
console.log(lotus.cache) // prints the synced chain
```

### Constructor options

```
{
  jsonrpcEndpoint: <String> (defaults to 'http://127.0.0.1:1234/rpc/v0')
}
```

### explore options

```
await lotus.explore({
  fromHeight: <String> || <Number>,
  toHeight: <String> || <Number> // defaults to the current ChainHead
})
```

### CORS

We need to figure this out