-- ═════════════════════════════════════════════════════════════════════
-- Mercancía / Marketplace ("Contrabando") — columnas for_sale en collection
-- Aplicada en producción 2026-05-23 vía MCP apply_migration
-- ═════════════════════════════════════════════════════════════════════

ALTER TABLE collection
  ADD COLUMN IF NOT EXISTS for_sale BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sale_price DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS sale_notes TEXT,
  ADD COLUMN IF NOT EXISTS listed_at TIMESTAMPTZ;

-- Index parcial: muy eficiente porque la mayoría de cartas NO están en venta
CREATE INDEX IF NOT EXISTS idx_collection_for_sale_listed
  ON collection (listed_at DESC NULLS LAST)
  WHERE for_sale = true;

CREATE INDEX IF NOT EXISTS idx_collection_for_sale_card
  ON collection (card_id, listed_at DESC NULLS LAST)
  WHERE for_sale = true;
