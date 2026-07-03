-- V4 — Support de la reprise après redémarrage (intégration AFITECH)
--
-- month_metrics    : compteurs mensuels du moteur, persistés à chaque mutation et
--                    rechargés au démarrage, pour que les décisions de seuil
--                    (facture/utilisation) survivent à un redéploiement.
-- bet.settle_amount: montant réglé (gain payé) enregistré sur WIN/LOSS/rollback,
--                    pour pouvoir rejouer vers AFITECH le bon paid_amount d'un
--                    ticket resté PENDING.

CREATE TABLE IF NOT EXISTS month_metrics (
    month      TEXT PRIMARY KEY,
    data       JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ADD COLUMN sans DEFAULT : opération metadata-only sur PostgreSQL 11+ (pas de
-- réécriture de table). Aligné sur le type de bet.amount (NUMERIC(14,4)).
ALTER TABLE bet ADD COLUMN IF NOT EXISTS settle_amount NUMERIC(14,4);
