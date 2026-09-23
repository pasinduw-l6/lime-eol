-- Password digest for accounts that sign in locally.
-- Nullable: accounts federated through Entra never hold a password here, and a
-- seeded engineer has none until an account is issued for them.
ALTER TABLE "app_user" ADD COLUMN "password_hash" TEXT;
