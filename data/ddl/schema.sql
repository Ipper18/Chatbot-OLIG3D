-- Rozmowy
CREATE TABLE IF NOT EXISTS olig3d.conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    started_at timestamptz NOT NULL DEFAULT now(),
    user_agent text,
    ip inet
);

CREATE TABLE IF NOT EXISTS olig3d.messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    conversation_id uuid NOT NULL REFERENCES olig3d.conversations (id) ON DELETE CASCADE,
    role text NOT NULL CHECK (
        role IN ('user', 'assistant', 'system')
    ),
    content text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Cennik filamentów
CREATE TABLE IF NOT EXISTS olig3d.filaments (
    id serial PRIMARY KEY,
    material text NOT NULL, -- PLA, PETG, ...
    brand text,
    color text,
    density_g_cm3 numeric(5, 3),
    price_per_kg numeric(10, 2),
    source text,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Wyceny
CREATE TABLE IF NOT EXISTS olig3d.quotes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid (),
    job_item_id bigint REFERENCES olig3d.job_items (id),
    total_cost_pln numeric(10, 2),
    material_cost_pln numeric(10, 2),
    energy_cost_pln numeric(10, 2),
    margin_pln numeric(10, 2),
    estimated_time_min integer,
    currency text DEFAULT 'PLN',
    created_at timestamptz NOT NULL DEFAULT now()
);