# One database for all contexts

The shop uses one Postgres database for carts, orders and stock. Splitting it was considered and rejected because the team is two people and cross-context reports need joins.
