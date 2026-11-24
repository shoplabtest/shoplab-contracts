# Changelog

Semver. Breaking contract changes bump the major version.

## 2.0.0
- Orders: new operation `getOrderLines` (`GET /orders/{id}/lines`). Additive.
- Breaking: payments operation `getPayment` is renamed `getPaymentById`, to match `getOrderById`-style naming used elsewhere. Clients regenerate with `scripts/generate.mjs`.

## 1.4.0
- `scripts/generate.mjs` generates TypeScript types and a typed client (one method per `operationId`) from the OpenAPI specs; consumers commit the generated file.
- Spec fixes, matching what the services return: `Cart.coupon` and `OrderSummary.cartId` are required, and the checkout answer requires `cartId`.

## 1.3.0
- Phase 2: orders, payments and invoices OpenAPI specs; events `order.placed`, `order.cancelled`, `payment.captured`, `payment.failed`, `stock.low`. Additive only.

## 1.2.0
- iam: add `updateUser` (`PATCH /users/{id}`). Additive only.

## 1.1.0
- cart-api: add `updateCartItem`, `removeCartItem`, `mergeCart`; optional `CartLine.latestUnitPrice`. Additive only.

## 1.0.0
- Phase 1 baseline: iam, catalog-api and cart-api OpenAPI specs; events `user.registered`, `user.role_changed`, `product.updated`, `cart.checked_out`.
