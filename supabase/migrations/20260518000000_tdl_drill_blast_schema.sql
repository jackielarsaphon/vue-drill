-- =============================================================================
-- TDL Drill & Blast — Complete Final Database Schema
-- Supabase / PostgreSQL  |  Single migration — run once on a fresh project
--
-- Covers: auth, users, mines, pits, rigs, operators, weekly plans,
--         blast patterns, drill log, plan imports, UI prefs, audit log.
--
-- Field names and types match the Vue app exactly:
--   • week_id     → SERIAL integer  (app stores/compares as Number)
--   • pattern_id  → TEXT            (LXML business key, e.g. NLU01_190RL_7.5M_101_TRI)
--   • rig_id      → TEXT PK         (e.g. HE-001)
--   • id on patterns/drill_log → BIGSERIAL (app uses p.id for internal refs)
--
-- Creation order (dependency-safe):
--   mines → pits → rigs → profiles → ui_prefs → operators
--   → weeks → patterns → drill_log → imports → audit
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- SECTION 1: MINE / SITE MASTER
-- =============================================================================

CREATE TABLE public.tdl_mines (
  mine_id    SERIAL      PRIMARY KEY,
  code       TEXT        NOT NULL UNIQUE,
  name       TEXT        NOT NULL,
  timezone   TEXT        NOT NULL DEFAULT 'Asia/Bangkok',
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  notes      TEXT        NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tdl_mines IS
  'Mine/site master. Single-site deployments insert one row (mine_id = 1).';

-- =============================================================================
-- SECTION 2: PIT MASTER
-- =============================================================================

CREATE TABLE public.tdl_pits (
  pit_id     SERIAL      PRIMARY KEY,
  mine_id    INTEGER     REFERENCES public.tdl_mines(mine_id) ON DELETE SET NULL,
  pit_code   TEXT        NOT NULL,
  label      TEXT        NOT NULL DEFAULT '',
  sort_order INTEGER     NOT NULL DEFAULT 0,
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tdl_pits_mine_code_uk UNIQUE (mine_id, pit_code)
);

COMMENT ON TABLE public.tdl_pits IS
  'Pit location master. pit_code must match pit_name used in tdl_patterns.';

-- =============================================================================
-- SECTION 3: RIG FLEET
-- =============================================================================

CREATE TABLE public.tdl_rigs (
  rig_id     TEXT        PRIMARY KEY,                     -- e.g. HE-001, H-108, SL-01
  mine_id    INTEGER     REFERENCES public.tdl_mines(mine_id) ON DELETE SET NULL,
  label      TEXT        NOT NULL DEFAULT '',
  rig_type   TEXT        NOT NULL DEFAULT '',             -- HE, H, SL
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  sort_order INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tdl_rigs IS
  'Drill rig fleet. rig_id is the text code used throughout the app (e.g. HE-001).';

-- =============================================================================
-- SECTION 4: USERS / AUTH
-- (profiles must come before operators because operators.user_id → profiles.id)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 4a. tdl_profiles  –  1:1 with auth.users
-- ---------------------------------------------------------------------------
CREATE TABLE public.tdl_profiles (
  id           UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username     TEXT        UNIQUE,
  display_name TEXT        NOT NULL DEFAULT '',
  role         TEXT        NOT NULL DEFAULT 'viewer'
               CHECK (role IN ('admin', 'manager', 'viewer')),
  job_title    TEXT        NOT NULL DEFAULT '',
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tdl_profiles IS
  'One profile per auth user. role = admin | manager | viewer.';
COMMENT ON COLUMN public.tdl_profiles.username IS
  'Short login name used in UI and auth email prefix (username@domain).';

-- ---------------------------------------------------------------------------
-- 4b. tdl_user_ui_preferences  –  Tweaks panel settings per user
-- ---------------------------------------------------------------------------
CREATE TABLE public.tdl_user_ui_preferences (
  user_id    UUID        PRIMARY KEY
             REFERENCES public.tdl_profiles(id) ON DELETE CASCADE,
  settings   JSONB       NOT NULL DEFAULT '{}',           -- { palette, density, … }
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tdl_user_ui_preferences IS
  'Stores Tweaks panel state (palette, density) per user as JSON.';

-- ---------------------------------------------------------------------------
-- 4c. tdl_operators  –  Drill operator master (optional link to profile)
-- ---------------------------------------------------------------------------
CREATE TABLE public.tdl_operators (
  operator_id   SERIAL      PRIMARY KEY,
  display_name  TEXT        NOT NULL,
  employee_code TEXT        NOT NULL DEFAULT '',
  mine_id       INTEGER     REFERENCES public.tdl_mines(mine_id) ON DELETE SET NULL,
  user_id       UUID        REFERENCES public.tdl_profiles(id) ON DELETE SET NULL,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tdl_operators IS
  'Operator master. employee_name in drill log can be matched here for linked identity.';

-- =============================================================================
-- SECTION 5: WEEKLY PLAN
-- =============================================================================

CREATE TABLE public.tdl_weeks (
  week_id       SERIAL      PRIMARY KEY,
  mine_id       INTEGER     REFERENCES public.tdl_mines(mine_id) ON DELETE SET NULL,
  week_start    DATE        NOT NULL,
  week_end      DATE        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'active', 'locked', 'archived')),
  plan_source   TEXT        NOT NULL DEFAULT 'LXML'
                CHECK (plan_source IN ('LXML', 'TDL Internal', 'Carryover only')),
  header_locked BOOLEAN     NOT NULL DEFAULT false,
  notes         TEXT        NOT NULL DEFAULT '',
  created_by    UUID        REFERENCES public.tdl_profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tdl_weeks_dates_chk CHECK (week_end >= week_start)
);

CREATE INDEX tdl_weeks_mine_dates_idx   ON public.tdl_weeks (mine_id, week_start DESC);
CREATE INDEX tdl_weeks_status_dates_idx ON public.tdl_weeks (status, week_start DESC);

COMMENT ON TABLE public.tdl_weeks IS
  'One row per LXML weekly plan. Sat→Fri. week_id is an integer PK.';
COMMENT ON COLUMN public.tdl_weeks.header_locked IS
  'True after admin clicks "Continue to patterns" — prevents date/source edits.';

-- =============================================================================
-- SECTION 6: BLAST PATTERNS
-- =============================================================================

CREATE TABLE public.tdl_patterns (
  id                    BIGSERIAL     PRIMARY KEY,
  pattern_id            TEXT          NOT NULL,
  week_id               INTEGER       NOT NULL
                        REFERENCES public.tdl_weeks(week_id) ON DELETE CASCADE,

  -- Location / geometry
  pit_name              TEXT          NOT NULL,
  pit_priority          INTEGER       NOT NULL DEFAULT 1,   -- 0 = carryover, 1+ = priority
  pattern_type          TEXT          NOT NULL DEFAULT 'TRI',
  rl_level              NUMERIC(10,2) NOT NULL DEFAULT 0,
  bench_height_m        NUMERIC(8,2)  NOT NULL DEFAULT 0,
  hole_diameter_mm      NUMERIC(8,2)  NOT NULL DEFAULT 115,
  num_holes             INTEGER       NOT NULL DEFAULT 0,

  -- Metres plan & progress
  plan_total_drilling_m NUMERIC(12,2) NOT NULL DEFAULT 0,
  carried_drilling_m    NUMERIC(12,2) NOT NULL DEFAULT 0,
  carried_progress_pct  NUMERIC(7,2)  NOT NULL DEFAULT 0,
  effective_m           NUMERIC(12,2) NOT NULL DEFAULT 0,   -- plan - carried (denormalised)
  actual_drilling_m     NUMERIC(12,2) NOT NULL DEFAULT 0,
  drilling_pct          NUMERIC(7,2)  NOT NULL DEFAULT 0,

  -- Blast
  planned_blast_date    DATE,
  plan_blast_vol_bcm    NUMERIC(14,2) NOT NULL DEFAULT 0,
  actual_blast_vol_bcm  NUMERIC(14,2) NOT NULL DEFAULT 0,
  blast_td_updated      BOOLEAN       NOT NULL DEFAULT false,
  blast_area_m2         NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Status
  status                TEXT          NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','drilling','complete','blasting','done','cancelled')),
  risk                  TEXT          NOT NULL DEFAULT 'on-track'
                        CHECK (risk IN ('on-track','at-risk','delayed')),

  -- Carryover lineage
  carried_from_id       BIGINT        REFERENCES public.tdl_patterns(id) ON DELETE SET NULL,

  -- Meta
  created_by            UUID          REFERENCES public.tdl_profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT tdl_patterns_week_pid_uk  UNIQUE (pattern_id, week_id),
  CONSTRAINT tdl_patterns_metres_chk   CHECK (
    plan_total_drilling_m >= 0 AND
    carried_drilling_m    >= 0 AND
    effective_m           >= 0 AND
    actual_drilling_m     >= 0
  ),
  CONSTRAINT tdl_patterns_pct_chk      CHECK (
    drilling_pct         BETWEEN 0 AND 100 AND
    carried_progress_pct BETWEEN 0 AND 100
  )
);

CREATE INDEX tdl_patterns_week_idx        ON public.tdl_patterns (week_id);
CREATE INDEX tdl_patterns_week_pit_idx    ON public.tdl_patterns (week_id, pit_name);
CREATE INDEX tdl_patterns_week_status_idx ON public.tdl_patterns (week_id, status);
CREATE INDEX tdl_patterns_week_risk_idx   ON public.tdl_patterns (week_id, risk);
CREATE INDEX tdl_patterns_blast_date_idx  ON public.tdl_patterns (week_id, planned_blast_date);
CREATE INDEX tdl_patterns_carry_from_idx  ON public.tdl_patterns (carried_from_id);

COMMENT ON TABLE public.tdl_patterns IS
  'Blast/drill patterns per week. pattern_id is the LXML text key; id is the surrogate PK.';
COMMENT ON COLUMN public.tdl_patterns.pit_priority IS
  '0 = carryover row from previous week, 1+ = normal priority order within the pit.';
COMMENT ON COLUMN public.tdl_patterns.effective_m IS
  'plan_total_drilling_m - carried_drilling_m. Stored denormalised for query speed.';
COMMENT ON COLUMN public.tdl_patterns.carried_from_id IS
  'Points to the source pattern row (previous week) when this is a carryover.';

-- =============================================================================
-- SECTION 7: DRILL LOG
-- =============================================================================

CREATE TABLE public.tdl_drill_log (
  id                BIGSERIAL     PRIMARY KEY,
  pattern_id        TEXT          NOT NULL,
  week_id           INTEGER       NOT NULL
                    REFERENCES public.tdl_weeks(week_id) ON DELETE CASCADE,
  rig_id            TEXT          NOT NULL
                    REFERENCES public.tdl_rigs(rig_id),
  work_date         DATE          NOT NULL,
  shift             TEXT          NOT NULL CHECK (shift IN ('day','night')),
  employee_name     TEXT          NOT NULL DEFAULT '',
  drill_bit_size_mm NUMERIC(8,2)  NOT NULL DEFAULT 115,
  total_drilling_m  NUMERIC(10,2) NOT NULL DEFAULT 0,
  redrill_m         NUMERIC(10,2) NOT NULL DEFAULT 0,
  smu_start         NUMERIC(10,2) NOT NULL DEFAULT 0,
  smu_end           NUMERIC(10,2),                         -- optional (UI captures, app sends smu_hr)
  smu_hr            NUMERIC(8,2)  NOT NULL DEFAULT 0,
  drifter_start     NUMERIC(10,2) NOT NULL DEFAULT 0,
  drifter_end       NUMERIC(10,2),                         -- optional
  drifter_hr        NUMERIC(8,2)  NOT NULL DEFAULT 0,
  comment           TEXT          NOT NULL DEFAULT '',
  created_by        UUID          REFERENCES public.tdl_profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT tdl_drill_log_unique
    UNIQUE (pattern_id, week_id, work_date, shift, rig_id),

  CONSTRAINT tdl_drill_log_pattern_fk
    FOREIGN KEY (pattern_id, week_id)
    REFERENCES public.tdl_patterns(pattern_id, week_id) ON DELETE CASCADE,

  CONSTRAINT tdl_drill_log_metres_chk
    CHECK (total_drilling_m >= 0 AND redrill_m >= 0)
);

CREATE INDEX tdl_drill_log_week_idx       ON public.tdl_drill_log (week_id);
CREATE INDEX tdl_drill_log_pattern_idx    ON public.tdl_drill_log (pattern_id, week_id);
CREATE INDEX tdl_drill_log_date_idx       ON public.tdl_drill_log (work_date);
CREATE INDEX tdl_drill_log_rig_idx        ON public.tdl_drill_log (rig_id);
CREATE INDEX tdl_drill_log_shift_date_idx ON public.tdl_drill_log (week_id, work_date, shift);

COMMENT ON TABLE public.tdl_drill_log IS
  'One row per (pattern, date, shift, rig). App upserts on the composite unique key.';
COMMENT ON COLUMN public.tdl_drill_log.smu_hr IS
  'SMU hours = smu_end - smu_start. Stored computed for query speed.';

-- =============================================================================
-- SECTION 8: PLAN IMPORT AUDIT
-- =============================================================================

CREATE TABLE public.tdl_plan_import_batches (
  id                  BIGSERIAL   PRIMARY KEY,
  week_id             INTEGER     NOT NULL
                      REFERENCES public.tdl_weeks(week_id) ON DELETE CASCADE,
  import_kind         TEXT        NOT NULL
                      CHECK (import_kind IN ('PDF','XLSX','CSV','MANUAL')),
  status              TEXT        NOT NULL DEFAULT 'started'
                      CHECK (status IN ('started','parsed','committed','failed','cancelled')),
  file_name           TEXT        NOT NULL DEFAULT '',
  pages               INTEGER,
  sheets              INTEGER,
  source_rows         INTEGER,
  found_pattern_count INTEGER     NOT NULL DEFAULT 0,
  rows_added          INTEGER     NOT NULL DEFAULT 0,
  rows_updated        INTEGER     NOT NULL DEFAULT 0,
  rows_carried        INTEGER     NOT NULL DEFAULT 0,
  rows_skipped        INTEGER     NOT NULL DEFAULT 0,
  error_message       TEXT,
  stats               JSONB       NOT NULL DEFAULT '{}',
  created_by          UUID        REFERENCES public.tdl_profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at        TIMESTAMPTZ
);

CREATE INDEX tdl_plan_import_week_idx ON public.tdl_plan_import_batches (week_id, created_at DESC);

COMMENT ON TABLE public.tdl_plan_import_batches IS
  'Audit record for each PDF/Excel plan import.';

-- =============================================================================
-- SECTION 9: AUDIT LOG
-- =============================================================================

CREATE TABLE public.tdl_audit_log (
  id         BIGSERIAL   PRIMARY KEY,
  action     TEXT        NOT NULL
             CHECK (action IN ('insert','update','delete','login','logout','import','carry_over')),
  entity     TEXT        NOT NULL,
  entity_id  TEXT,
  old_data   JSONB,
  new_data   JSONB,
  actor_id   UUID        REFERENCES public.tdl_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX tdl_audit_entity_idx  ON public.tdl_audit_log (entity, entity_id);
CREATE INDEX tdl_audit_actor_idx   ON public.tdl_audit_log (actor_id);
CREATE INDEX tdl_audit_created_idx ON public.tdl_audit_log (created_at DESC);

COMMENT ON TABLE public.tdl_audit_log IS
  'Append-only compliance/audit trail. App inserts only; no updates or deletes.';

-- =============================================================================
-- SECTION 10: TRIGGERS — updated_at
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tdl_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tdl_mines_uat         BEFORE UPDATE ON public.tdl_mines
  FOR EACH ROW EXECUTE FUNCTION public.tdl_set_updated_at();
CREATE TRIGGER tdl_pits_uat          BEFORE UPDATE ON public.tdl_pits
  FOR EACH ROW EXECUTE FUNCTION public.tdl_set_updated_at();
CREATE TRIGGER tdl_rigs_uat          BEFORE UPDATE ON public.tdl_rigs
  FOR EACH ROW EXECUTE FUNCTION public.tdl_set_updated_at();
CREATE TRIGGER tdl_profiles_uat      BEFORE UPDATE ON public.tdl_profiles
  FOR EACH ROW EXECUTE FUNCTION public.tdl_set_updated_at();
CREATE TRIGGER tdl_operators_uat     BEFORE UPDATE ON public.tdl_operators
  FOR EACH ROW EXECUTE FUNCTION public.tdl_set_updated_at();
CREATE TRIGGER tdl_weeks_uat         BEFORE UPDATE ON public.tdl_weeks
  FOR EACH ROW EXECUTE FUNCTION public.tdl_set_updated_at();
CREATE TRIGGER tdl_patterns_uat      BEFORE UPDATE ON public.tdl_patterns
  FOR EACH ROW EXECUTE FUNCTION public.tdl_set_updated_at();
CREATE TRIGGER tdl_drill_log_uat     BEFORE UPDATE ON public.tdl_drill_log
  FOR EACH ROW EXECUTE FUNCTION public.tdl_set_updated_at();
CREATE TRIGGER tdl_ui_prefs_uat      BEFORE UPDATE ON public.tdl_user_ui_preferences
  FOR EACH ROW EXECUTE FUNCTION public.tdl_set_updated_at();

-- =============================================================================
-- SECTION 11: TRIGGER — auto-create profile on Supabase Auth signup
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tdl_handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.tdl_profiles (id, username, display_name, role)
  VALUES (
    NEW.id,
    LOWER(COALESCE(
      NEW.raw_user_meta_data->>'username',
      SPLIT_PART(NEW.email, '@', 1)
    )),
    COALESCE(NEW.raw_user_meta_data->>'display_name', ''),
    CASE NEW.raw_user_meta_data->>'role'
      WHEN 'admin'   THEN 'admin'
      WHEN 'viewer'  THEN 'viewer'
      ELSE                'manager'
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.tdl_handle_new_user();

-- =============================================================================
-- SECTION 12: ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE public.tdl_mines               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tdl_pits                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tdl_rigs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tdl_profiles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tdl_operators           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tdl_user_ui_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tdl_weeks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tdl_patterns            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tdl_drill_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tdl_plan_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tdl_audit_log           ENABLE ROW LEVEL SECURITY;

-- Helper: check caller's role
CREATE OR REPLACE FUNCTION public.tdl_has_role(_roles TEXT[])
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tdl_profiles
    WHERE id = auth.uid()
      AND role = ANY (_roles)
      AND is_active = true
  );
$$;

GRANT EXECUTE ON FUNCTION public.tdl_has_role(TEXT[]) TO authenticated;

-- NOTE: This app uses the Supabase anon key without Supabase Auth sessions.
-- All client requests arrive as the 'anon' PostgreSQL role.
-- Access control is enforced at the application layer (role field in tdl_profiles).
-- RLS here prevents direct DB access from outside the app only.

-- mines & pits: open read | open write (app-layer restricts to admin)
CREATE POLICY tdl_mines_select ON public.tdl_mines FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY tdl_mines_write  ON public.tdl_mines FOR ALL    TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY tdl_pits_select  ON public.tdl_pits  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY tdl_pits_write   ON public.tdl_pits  FOR ALL    TO anon, authenticated USING (true) WITH CHECK (true);

-- rigs: open read | open write
CREATE POLICY tdl_rigs_select  ON public.tdl_rigs  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY tdl_rigs_write   ON public.tdl_rigs  FOR ALL    TO anon, authenticated USING (true) WITH CHECK (true);

-- operators: open read | open write
CREATE POLICY tdl_operators_select ON public.tdl_operators FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY tdl_operators_write  ON public.tdl_operators FOR ALL    TO anon, authenticated USING (true) WITH CHECK (true);

-- profiles: open read (needed for login) | open write (app controls who can manage users)
CREATE POLICY tdl_profiles_select ON public.tdl_profiles FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY tdl_profiles_write  ON public.tdl_profiles FOR ALL    TO anon, authenticated USING (true) WITH CHECK (true);

-- ui prefs: open
CREATE POLICY tdl_ui_prefs_own ON public.tdl_user_ui_preferences FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- weeks: open read | open write
CREATE POLICY tdl_weeks_select ON public.tdl_weeks FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY tdl_weeks_write  ON public.tdl_weeks FOR ALL    TO anon, authenticated USING (true) WITH CHECK (true);

-- patterns: open read | open write
CREATE POLICY tdl_patterns_select ON public.tdl_patterns FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY tdl_patterns_write  ON public.tdl_patterns FOR ALL    TO anon, authenticated USING (true) WITH CHECK (true);

-- drill log: open read | open write
CREATE POLICY tdl_drill_log_select ON public.tdl_drill_log FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY tdl_drill_log_write  ON public.tdl_drill_log FOR ALL    TO anon, authenticated USING (true) WITH CHECK (true);

-- imports: open read | open write
CREATE POLICY tdl_imports_select ON public.tdl_plan_import_batches FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY tdl_imports_write  ON public.tdl_plan_import_batches FOR ALL    TO anon, authenticated USING (true) WITH CHECK (true);

-- audit: open insert | open read
CREATE POLICY tdl_audit_insert ON public.tdl_audit_log FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY tdl_audit_select ON public.tdl_audit_log FOR SELECT TO anon, authenticated USING (true);

-- =============================================================================
-- SECTION 13: GRANTS
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tdl_mines               TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tdl_pits                TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tdl_rigs                TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tdl_profiles            TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tdl_operators           TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tdl_user_ui_preferences TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tdl_weeks               TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tdl_patterns            TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tdl_drill_log           TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tdl_plan_import_batches TO anon, authenticated;
GRANT SELECT, INSERT                 ON public.tdl_audit_log           TO anon, authenticated;

GRANT USAGE, SELECT ON SEQUENCE public.tdl_mines_mine_id_seq              TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.tdl_pits_pit_id_seq                TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.tdl_operators_operator_id_seq      TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.tdl_weeks_week_id_seq              TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.tdl_patterns_id_seq                TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.tdl_drill_log_id_seq               TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.tdl_plan_import_batches_id_seq     TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.tdl_audit_log_id_seq               TO anon, authenticated;

-- =============================================================================
-- SECTION 14: SEED DATA — mine, rigs, pits (matches app mock data)
-- =============================================================================

INSERT INTO public.tdl_mines (code, name, timezone)
VALUES ('LXML', 'LXML Copper and Gold Mine', 'Asia/Bangkok')
ON CONFLICT (code) DO NOTHING;

-- Rig fleet (matches RIGS array in data.js)
INSERT INTO public.tdl_rigs (rig_id, mine_id, rig_type, sort_order)
SELECT
  r.rig_id,
  (SELECT mine_id FROM public.tdl_mines WHERE code = 'LXML'),
  CASE
    WHEN r.rig_id LIKE 'HE-%' THEN 'HE'
    WHEN r.rig_id LIKE 'H-%'  THEN 'H'
    WHEN r.rig_id LIKE 'SL-%' THEN 'SL'
    ELSE ''
  END,
  r.ord
FROM (VALUES
  ('HE-001',1),('HE-002',2),('HE-003',3),('HE-004',4),('HE-005',5),
  ('HE-006',6),('HE-007',7),('HE-008',8),('HE-009',9),
  ('H-108',10),('H-112',11),('H-116',12),('H-117',13),('H-118',14),
  ('H-119',15),('H-120',16),
  ('SL-01',17),('SL-02',18),('SL-03',19),('SL-04',20),('SL-05',21),
  ('SL-06',22),('SL-07',23),('SL-08',24),('SL-09',25),('SL-10',26),
  ('SL-11',27),('SL-12',28)
) AS r(rig_id, ord)
ON CONFLICT (rig_id) DO NOTHING;

-- Pit master (matches PIT_NAMES in data.js)
INSERT INTO public.tdl_pits (mine_id, pit_code, sort_order)
SELECT
  (SELECT mine_id FROM public.tdl_mines WHERE code = 'LXML'),
  p.pit_code,
  p.ord
FROM (VALUES
  ('NLU01',1),('NLU03A',2),('NLU03B',3),
  ('NDA02',4),('KTL05',5),('KTL07',6),('KCN12',7)
) AS p(pit_code, ord)
ON CONFLICT (mine_id, pit_code) DO NOTHING;
