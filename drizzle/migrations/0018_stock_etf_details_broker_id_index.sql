-- broker_id op stock_etf_details heeft geen index, terwijl posities per broker
-- worden opgehaald/gejoind (broker-detailpagina, positietabel per broker).

CREATE INDEX "stock_etf_details_broker_id_idx" ON "stock_etf_details" ("broker_id");
