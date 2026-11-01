# shoplab-contracts

Published API specs and event schemas for ShopLab, versioned with semver (see CHANGELOG.md).

- `openapi/<service>.yaml`: one OpenAPI 3 spec per service. `operationId` is globally unique.
- `events/<name>.schema.json`: one JSON Schema per event on the `shop.events` exchange.

`npm test` checks unique operation ids, resolvable `$ref`s and well-formed event schemas.
