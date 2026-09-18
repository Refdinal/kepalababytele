CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  telegram_user_id BIGINT NOT NULL UNIQUE,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id BIGINT,
  host_user_id BIGINT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING', 'PLAYING', 'FINISHED', 'CANCELLED')),
  current_player_id BIGINT REFERENCES users(id),
  turn_number INTEGER NOT NULL DEFAULT 0,
  pig_head_player_id BIGINT REFERENCES users(id),
  lobby_message_id BIGINT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_players (
  id BIGSERIAL PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  user_id BIGINT NOT NULL REFERENCES users(id),
  seat_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'OUT')),
  card_count INTEGER NOT NULL DEFAULT 0,
  dm_message_id BIGINT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  UNIQUE (game_id, user_id),
  UNIQUE (game_id, seat_number)
);

CREATE TABLE IF NOT EXISTS game_cards (
  id BIGSERIAL PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  card_code TEXT NOT NULL,
  player_id BIGINT REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'IN_HAND' CHECK (status IN ('IN_HAND', 'DISCARDED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (game_id, card_code)
);

CREATE INDEX IF NOT EXISTS idx_game_players_game ON game_players (game_id);
CREATE INDEX IF NOT EXISTS idx_game_cards_game_status ON game_cards (game_id, status);
CREATE INDEX IF NOT EXISTS idx_games_chat_status ON games (chat_id, status);
CREATE INDEX IF NOT EXISTS idx_games_status ON games (status);
