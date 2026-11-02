# Changelog

Semver. Breaking contract changes bump the major version.

## 1.3.0
- Phase 2: orders, payments and invoices OpenAPI specs; events `order.placed`, `order.cancelled`, `payment.captured`, `payment.failed`. Additive only.

## 1.2.0
- iam: add `updateUser` (`PATCH /users/{id}`). Additive only.

## 1.1.0
- cart-api: add `updateCartItem`, `removeCartItem`, `mergeCart`; optional `CartLine.latestUnitPrice`. Additive only.

## 1.0.0
- Phase 1 baseline: iam, catalog-api and cart-api OpenAPI specs; events `user.registered`, `user.role_changed`, `product.updated`, `cart.checked_out`.
