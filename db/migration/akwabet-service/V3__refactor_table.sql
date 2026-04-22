DROP TABLE IF EXISTS 
    summary_report,
    player_report,
    bet_outcome,
    outcome,
    event,
    bet,
    wallet_transaction,
    provider,
    player 
CASCADE;


-- 1. TABLE DES JOUEURS (player)
CREATE TABLE player (
    id SERIAL PRIMARY KEY,
    player_id BIGINT UNIQUE NOT NULL,      -- ID externe/système du joueur
    msisdn VARCHAR(50),                     -- Numéro de téléphone
    balance NUMERIC(14,4) DEFAULT 0,        -- Solde argent réel
    bonus_balance NUMERIC(14,4) DEFAULT 0,  -- Solde bonus
    promo_balance NUMERIC(14,4) DEFAULT 0,  -- Solde promotionnel
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. TABLE DES FOURNISSEURS (provider)
CREATE TABLE provider (
    id SERIAL PRIMARY KEY,
    provider_name VARCHAR(255) NOT NULL,
    currency VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. TABLE DES TRANSACTIONS WALLET (wallet_transaction)
-- C'est la source de vérité pour tous les mouvements de fonds.
CREATE TABLE wallet_transaction (
    id SERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    type VARCHAR(50) NOT NULL, -- deposit, withdrawal 
    amount NUMERIC(14,4) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    transaction_id VARCHAR(100),           -- ID externe (pour les dépôts/retraits)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,-- Données brutes optionnelles
    CONSTRAINT fk_wallet_transaction_player FOREIGN KEY (user_id) REFERENCES player (player_id) ON DELETE CASCADE
);

-- 4. TABLE DES PARIS / TICKETS (bet)
CREATE TABLE bet (
    id SERIAL PRIMARY KEY,
    bet_id VARCHAR(100) UNIQUE NOT NULL,    -- ID unique du ticket
    user_id BIGINT NOT NULL,
    product VARCHAR(50) DEFAULT 'sport',     -- sport, casino, jackpot
    source VARCHAR(50) DEFAULT 'realmoney', -- realmoney, bonus, promo
    amount NUMERIC(14,4) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    is_cashout BOOLEAN DEFAULT FALSE, 
    event_timestamp TIMESTAMP,
    type VARCHAR(50) NOT NULL, -- bet, bet_rollback, win, win_rollback, deposit, withdrawal
    CONSTRAINT fk_bet_player FOREIGN KEY (user_id) REFERENCES player (player_id) ON DELETE CASCADE
    /* CONSTRAINT fk_bet_provider FOREIGN KEY (provider_id) REFERENCES provider (id) ON DELETE SET NULL */
);

-- 5. TABLE DES EVENEMENTS (event)
CREATE TABLE event (
    id BIGINT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    date TIMESTAMP,
    sport VARCHAR(100),
    category VARCHAR(100),
    tournament VARCHAR(100),
    sport_id BIGINT,
    category_id BIGINT,
    tournament_id BIGINT
);

-- 6. TABLE DES RESULTATS POSSIBLES (outcome)
CREATE TABLE outcome (
    id BIGINT PRIMARY KEY,
    event_id BIGINT NOT NULL,
    name VARCHAR(255),
    market VARCHAR(255),
    odd NUMERIC(10,2),
    type VARCHAR(50),
    fixed BOOLEAN DEFAULT FALSE,
    is_live BOOLEAN DEFAULT FALSE,
    status VARCHAR(10),
    CONSTRAINT fk_outcome_event FOREIGN KEY (event_id) REFERENCES event (id) ON DELETE CASCADE
);

-- 7. TABLE DE LIAISON PARIS ET RESULTATS (bet_outcome)
CREATE TABLE bet_outcome (
    id SERIAL PRIMARY KEY,
    bet_id VARCHAR(100) NOT NULL,
    outcome_id BIGINT NOT NULL,
    is_bet_build BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_bet_outcome_bet FOREIGN KEY (bet_id) REFERENCES bet (bet_id) ON DELETE CASCADE,
    CONSTRAINT fk_bet_outcome_outcome FOREIGN KEY (outcome_id) REFERENCES outcome (id) ON DELETE CASCADE
);

-- 8. TABLE DES RAPPORTS PAR JOUEUR (player_report) - Agrégation quotidienne
CREATE TABLE player_report (
    id SERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL,
    product VARCHAR(50) DEFAULT 'sport',
    total_bet NUMERIC(14,4) DEFAULT 0,
    total_win NUMERIC(14,4) DEFAULT 0,
    bonus_bet NUMERIC(14,4) DEFAULT 0,
    bonus_win NUMERIC(14,4) DEFAULT 0,
    promo_bet NUMERIC(14,4) DEFAULT 0,
    promo_win NUMERIC(14,4) DEFAULT 0,
    total_bet_count INTEGER DEFAULT 0,
    report_date DATE DEFAULT CURRENT_DATE,
    CONSTRAINT fk_player_report_player FOREIGN KEY (player_id) REFERENCES player (player_id) ON DELETE CASCADE,
    -- Assurer un seul enregistrement par joueur/date/produit
    CONSTRAINT uq_player_report UNIQUE (player_id, report_date, product)
);

-- 9. TABLE DES RAPPORTS GLOBAUX (summary_report)
CREATE TABLE summary_report (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER NOT NULL,
    product VARCHAR(50) DEFAULT 'sport',
    currency VARCHAR(10),
    count INTEGER DEFAULT 0,
    bet NUMERIC(14,4) DEFAULT 0,
    bet_closed NUMERIC(14,4) DEFAULT 0,
    bonus_bet_closed NUMERIC(14,4) DEFAULT 0,
    win NUMERIC(14,4) DEFAULT 0,
    profit NUMERIC(14,4) DEFAULT 0,
    profit_closed NUMERIC(14,4) DEFAULT 0,
    bonus_bet NUMERIC(14,4) DEFAULT 0,
    bonus_win NUMERIC(14,4) DEFAULT 0,
    bet_tax NUMERIC(14,4) DEFAULT 0,
    win_tax NUMERIC(14,4) DEFAULT 0,
    rake NUMERIC(14,4) DEFAULT 0,
    promo_win NUMERIC(14,4),
    report_date DATE DEFAULT CURRENT_DATE,
    CONSTRAINT fk_summary_provider FOREIGN KEY (provider_id) REFERENCES provider (id) ON DELETE CASCADE,
    CONSTRAINT uq_summary_report UNIQUE (provider_id, report_date, product, currency)
);

-- 10. INDICES DE PERFORMANCE
CREATE INDEX idx_wallet_transaction_user_id ON wallet_transaction(user_id);
CREATE INDEX idx_wallet_transaction_type ON wallet_transaction(type);
CREATE INDEX idx_wallet_transaction_created_at ON wallet_transaction(created_at);
CREATE INDEX idx_bet_user_id ON bet(user_id);
CREATE INDEX idx_bet_event_timestamp ON bet(event_timestamp);