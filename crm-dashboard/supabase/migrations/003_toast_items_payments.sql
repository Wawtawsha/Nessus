-- Toast Order Items (line items from selections)
CREATE TABLE toast_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES toast_orders(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id),
  toast_selection_guid TEXT NOT NULL,
  toast_item_guid TEXT,
  display_name TEXT NOT NULL,
  quantity DECIMAL(10,3) DEFAULT 1,
  unit_price DECIMAL(10,2) DEFAULT 0,
  pre_discount_price DECIMAL(10,2) DEFAULT 0,
  price DECIMAL(10,2) DEFAULT 0,
  tax DECIMAL(10,2) DEFAULT 0,
  voided BOOLEAN DEFAULT false,
  seat_number INTEGER,
  is_modifier BOOLEAN DEFAULT false,
  parent_item_id UUID REFERENCES toast_order_items(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(order_id, toast_selection_guid)
);

-- Indexes for common queries
CREATE INDEX idx_toast_order_items_order_id ON toast_order_items(order_id);
CREATE INDEX idx_toast_order_items_client_id ON toast_order_items(client_id);
CREATE INDEX idx_toast_order_items_display_name ON toast_order_items(display_name);

-- RLS for toast_order_items
ALTER TABLE toast_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all order items" ON toast_order_items
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Client users can view their order items" ON toast_order_items
  FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM user_profiles WHERE id = auth.uid()
    )
  );

-- Toast Payments (payment breakdown per order)
CREATE TABLE toast_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES toast_orders(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id),
  toast_payment_guid TEXT NOT NULL,
  payment_type TEXT NOT NULL, -- CASH, CREDIT, GIFTCARD, HOUSE_ACCOUNT, OTHER, etc.
  amount DECIMAL(10,2) DEFAULT 0,
  tip_amount DECIMAL(10,2) DEFAULT 0,
  amount_tendered DECIMAL(10,2) DEFAULT 0,
  card_type TEXT, -- VISA, MASTERCARD, AMEX, DISCOVER, etc.
  last_four TEXT, -- Last 4 digits of card
  paid_date TIMESTAMPTZ,
  refund_status TEXT, -- NONE, PARTIAL, FULL
  voided BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(order_id, toast_payment_guid)
);

-- Indexes for payment analysis
CREATE INDEX idx_toast_payments_order_id ON toast_payments(order_id);
CREATE INDEX idx_toast_payments_client_id ON toast_payments(client_id);
CREATE INDEX idx_toast_payments_payment_type ON toast_payments(payment_type);
CREATE INDEX idx_toast_payments_card_type ON toast_payments(card_type);
CREATE INDEX idx_toast_payments_paid_date ON toast_payments(paid_date);

-- RLS for toast_payments
ALTER TABLE toast_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all payments" ON toast_payments
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "Client users can view their payments" ON toast_payments
  FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT client_id FROM user_profiles WHERE id = auth.uid()
    )
  );
