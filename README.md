# shoplab-contracts

Published API specs and event schemas for ShopLab, versioned with semver (see CHANGELOG.md).

- `openapi/<service>.yaml`: one OpenAPI 3 spec per service. `operationId` is globally unique.
- `events/<name>.schema.json`: one JSON Schema per event on the `shop.events` exchange.

`npm test` checks unique operation ids, resolvable `$ref`s and well-formed event schemas.

## Generated types and client

```
node ../shoplab-contracts/scripts/generate.mjs --services orders,payments --out src/generated/contracts.ts
```

Writes one TypeScript file with a type for every schema and `createClient(request)`, which has one method per operation named by its `operationId` (`client.listOrders()`, `client.createCharge({ orderId, method })`). Operations that do not return JSON (the invoice PDF) are not included. Commit the generated file in the consumer and regenerate it when the contracts change; renaming an `operationId` or a schema field is a breaking change for everyone who regenerates.
