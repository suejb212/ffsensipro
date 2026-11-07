CREATE TABLE IF NOT EXISTS premium_orders (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  style TEXT NOT NULL,
  scale INTEGER NOT NULL,
  provider_order_id TEXT,
  result TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
