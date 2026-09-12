# CLAUDE.md

Frontend for **Kento Shopping** — React 19 + TypeScript + Vite 8, consuming a Spring Boot REST API.

The backend is a **separate repo** at `~/Career/kento_shopping`. Read its source when this file and
`openapi.json` are not enough — controllers live in
`src/main/java/com/e_commerce/kento_shopping/controller/`.

## Commands

```bash
npm run dev        # :5173 — the backend's CORS allows this origin only
npm run build
npm run api:sync   # regenerate openapi.json + src/types/api.d.ts (backend must be running)
```

Backend: `./mvnw spring-boot:run` in `~/Career/kento_shopping`, serves `:8080`.
Base URL `http://localhost:8080/api/v1`, read from `VITE_API_BASE_URL` — never hardcode it.

## The contract

`openapi.json` is generated from the backend's `/v3/api-docs`; `src/types/api.d.ts` is generated
from it. **Never hand-edit either.** Never invent a field — if a shape is unclear, read the
generated type, or `curl` the running API and look at the real response.

The spec documents success responses only. Failure behaviour is below, and is not in the spec.

## Auth

`POST /auth/login` returns `{ token, user, roles, permissions }`. The JWT carries only `sub`,
`userId`, `iat`, `exp` — **no roles, no permissions**.

Authorities come from `GET /auth/me`, which returns fresh `roles` and `permissions` plus a `null`
token (the client keeps the one it already has). The backend reloads authorities on every request,
so a role change takes effect on the user's next call with no re-login. Don't cache permissions
from login for the whole session — re-read `/auth/me` after anything that could change them.

Send `Authorization: Bearer <token>` on every authenticated request.

## Errors

Every failure is `{ "status": number, "message": string }`.

| Code | Meaning | UI |
| ---- | ------- | -- |
| 400 | bad input, or a business rule was violated | show `message` |
| 401 | bad credentials | login failed |
| 403 | no permission, or the resource isn't yours | don't retry |
| 404 | not found | |
| 409 | conflict — duplicate email, or a concurrent write | show `message`, offer refresh |

Unwrap this shape once, in the API layer. Nothing outside `src/api/` should handle a raw Response.

## Separation of duties — read this before writing any flow

**Admins and staff cannot shop.** Cart, orders and addresses require `ROLE_CUSTOMER`, which admin
and staff accounts do not have. An admin hitting `/cart` gets 403, by design.

You need **two logins** to exercise the whole app. Never write a flow that logs in as an admin and
then adds to cart — it will fail, and the failure is correct.

## Seeded accounts

Password for all: `Kiet123456`

| Account | Roles |
| ------- | ----- |
| `admin@kento.com` | ADMIN |
| `product.staff@kento.com` | PRODUCT_STAFF |
| `order.staff@kento.com` | ORDER_STAFF |
| `flashsale@kento.com` | FLASHSALE_MANAGER |
| `nguyen.van.an@gmail.com` | CUSTOMER + ORDER_STAFF — deliberate dual-role fixture |
| 9 other `@gmail.com` accounts | CUSTOMER |

Customers hold **zero permissions** — correct, not a bug. A customer's access comes from being
authenticated plus owning the row.

## Permission-driven UI

Render admin navigation from `/auth/me`'s `permissions` list, not from a role name. The catalogue:

```
PRODUCT_CREATE PRODUCT_UPDATE PRODUCT_DELETE INVENTORY_UPDATE CATEGORY_MANAGE
ORDER_READ_ALL ORDER_UPDATE_STATUS ORDER_CANCEL_ANY
USER_READ USER_UPDATE ROLE_ASSIGN ROLE_MANAGE
TOPUP_READ_ALL TOPUP_APPROVE WALLET_READ_ALL WALLET_ADJUST
FLASHSALE_* — backend not built yet, no endpoints
```

Client-side checks are **cosmetic**: they hide UI the user cannot use. Enforcement is the
backend's `@PreAuthorize`. Never treat a hidden button as a security control.

`WALLET_ADJUST` has no endpoint — the permission is seeded but unimplemented. Don't build UI for it.

## Money

1 coin = 1 VND. Amounts arrive as `BigDecimal` — parse as **string**, never as a JS number.
Format with `Intl.NumberFormat('vi-VN')`.

Customers cannot mint coins. The flow is `POST /wallet/top-ups` (creates a PENDING request) → an
admin approves via `PUT /admin/top-ups/{id}/approve` → the balance changes. The balance does not
move until approval, so the wallet page needs a refresh or poll, not an optimistic update.
A customer may hold at most 3 pending requests.

`POST /orders/{orderId}/payment` takes **no request body**. COIN is the only payment method.
Insufficient balance returns 400 and leaves the order `PENDING` — the customer can top up and pay
that same order. Don't treat a failed payment as a dead order.

## Structure

```
src/
  api/       one module per resource; the ONLY place fetch is called
  auth/      token storage, AuthContext, ProtectedRoute, RequirePermission
  pages/     customer/ and admin/
  types/     api.d.ts (generated — do not edit)
```

Every request goes through `src/api/`. That is where the bearer token is attached, where the error
shape is unwrapped, and where a 401 triggers logout.

## Not built yet

Flash sale (backend Phase 3). `OrderStatus` will gain `PROCESSING` and `FAILED` — flash-sale orders
resolve asynchronously. Don't build for it yet, and don't assume an order's status is always
terminal once fetched.
