-- TABLE DES FOURNISSEURS (providers)
CREATE TABLE provider (
    id SERIAL PRIMARY KEY,
    provider_name VARCHAR(255) NOT NULL,
    currency VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MISE A JOUR DE LA TABLE PLAYER (creee en V1)
ALTER TABLE player DROP COLUMN IF EXISTS wallet;
ALTER TABLE player ALTER COLUMN player_id TYPE BIGINT USING player_id::BIGINT;
ALTER TABLE player ADD CONSTRAINT player_player_id_unique UNIQUE (player_id);
ALTER TABLE player ALTER COLUMN msisdn TYPE VARCHAR(50);
ALTER TABLE player ADD COLUMN IF NOT EXISTS balance NUMERIC(12,2) DEFAULT 0;
ALTER TABLE player ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- TABLE DES RAPPORTS JOUEURS (Player Report)
CREATE TABLE player_report (
    id SERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL,
    total_bet NUMERIC(14,4) DEFAULT 0,
    total_win NUMERIC(14,4) DEFAULT 0,
    total_bet_count INTEGER DEFAULT 0,
    report_date DATE DEFAULT CURRENT_DATE,
    CONSTRAINT fk_player_report_player FOREIGN KEY (player_id) REFERENCES player (player_id) ON DELETE CASCADE
);

-- TABLE DES RAPPORTS GLOBAUX (Summary Report)
CREATE TABLE summary_report (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER NOT NULL,
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
    CONSTRAINT fk_summary_provider FOREIGN KEY (provider_id) REFERENCES provider (id) ON DELETE CASCADE
);

-- TABLE DES EVENEMENTS (matchs, tournois, etc.)
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

-- TABLE DES OUTCOMES (résultats possibles pour un event)
CREATE TABLE outcome (
    id BIGINT PRIMARY KEY,
    event_id BIGINT NOT NULL,
    name VARCHAR(255),
    market VARCHAR(255),
    odd NUMERIC(6,2),
    type VARCHAR(50),
    fixed BOOLEAN DEFAULT FALSE,
    is_live BOOLEAN DEFAULT FALSE,
    status VARCHAR(10),
    CONSTRAINT fk_outcome_event FOREIGN KEY (event_id) REFERENCES event (id) ON DELETE CASCADE
);

-- TABLE DES PARIS (bets/tickets)
CREATE TABLE bet (
    id SERIAL PRIMARY KEY,
    bet_id VARCHAR(50) UNIQUE NOT NULL,
    player_id BIGINT NOT NULL,
    provider_id INTEGER,
    gross_stake NUMERIC(12,2),
    odds NUMERIC(6,2),
    stake_type VARCHAR(50),
    date_of_stake TIMESTAMP,
    excise_amt NUMERIC(10,2),
    expected_outcome_time TIMESTAMP,
    wallet_balance_after_stake NUMERIC(12,2),
    bet_origin VARCHAR(50),
    result CHAR(1),
    ticket_win NUMERIC(12,2),
    ticket_code VARCHAR(50),
    ticket_currency VARCHAR(10),
    CONSTRAINT fk_bet_player FOREIGN KEY (player_id) REFERENCES player (player_id) ON DELETE CASCADE,
    CONSTRAINT fk_bet_provider FOREIGN KEY (provider_id) REFERENCES provider (id) ON DELETE SET NULL
);

-- TABLE DE LIAISON ENTRE BET ET OUTCOME (chaque ticket contient plusieurs outcomes)
CREATE TABLE bet_outcome (
    id SERIAL PRIMARY KEY,
    bet_id VARCHAR(50) NOT NULL,
    outcome_id BIGINT NOT NULL,
    is_bet_build BOOLEAN DEFAULT FALSE,
    CONSTRAINT fk_bet_outcome_bet FOREIGN KEY (bet_id) REFERENCES bet (bet_id) ON DELETE CASCADE,
    CONSTRAINT fk_bet_outcome_outcome FOREIGN KEY (outcome_id) REFERENCES outcome (id) ON DELETE CASCADE
);