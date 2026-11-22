# Order pricing

`priceOrder(order)` returns the total in cents for an order.

Rules:

- The subtotal is the sum of `unitCents * quantity` over all lines.
- A coupon takes a percentage off the subtotal. Only `SAVE10` (10 percent) and `SAVE20` (20 percent) exist. An unknown code is ignored.
- Tax is added after the coupon. The rate depends on `order.region`: `EU` is 21 percent, `US` is 8 percent, any other region is 0.
- Every step rounds half up to a whole cent.
