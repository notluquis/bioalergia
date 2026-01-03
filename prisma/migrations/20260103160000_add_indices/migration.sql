-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "calendar_watch_channels_calendar_id_idx" ON "calendar_watch_channels"("calendar_id");

-- CreateIndex
CREATE INDEX "counterpart_accounts_counterpart_id_idx" ON "counterpart_accounts"("counterpart_id");

-- CreateIndex
CREATE INDEX "daily_production_balances_created_by_idx" ON "daily_production_balances"("created_by");

-- CreateIndex
CREATE INDEX "employee_timesheets_employee_id_idx" ON "employee_timesheets"("employee_id");

-- CreateIndex
CREATE INDEX "events_calendar_id_idx" ON "events"("calendar_id");

-- CreateIndex
CREATE INDEX "inventory_items_category_id_idx" ON "inventory_items"("category_id");

-- CreateIndex
CREATE INDEX "inventory_movements_item_id_idx" ON "inventory_movements"("item_id");

-- CreateIndex
CREATE INDEX "loan_schedules_loan_id_idx" ON "loan_schedules"("loan_id");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "services_counterpart_id_idx" ON "services"("counterpart_id");

-- CreateIndex
CREATE INDEX "supply_requests_user_id_idx" ON "supply_requests"("user_id");

-- CreateIndex
CREATE INDEX "transactions_person_id_idx" ON "transactions"("person_id");

-- CreateIndex
CREATE INDEX "transactions_transaction_date_idx" ON "transactions"("transaction_date");

