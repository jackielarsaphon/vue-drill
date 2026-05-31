-- =============================================================================
-- TDL Drill & Blast — Rigs & Operators Seed
-- รัน SQL นี้ใน Supabase SQL Editor (Dashboard → SQL Editor → New query)
--
-- ทำอะไร:
--   1. เพิ่ม column contractor ใน tdl_rigs (ถ้ายังไม่มี)
--   2. เติมข้อมูล rig fleet + contractor (ตรงกับ data.js)
--   3. เติมข้อมูล operators 10 คน (ตรงกับ data.js)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. เพิ่ม contractor column ใน tdl_rigs (safe — IF NOT EXISTS)
-- -----------------------------------------------------------------------------
ALTER TABLE public.tdl_rigs
  ADD COLUMN IF NOT EXISTS contractor TEXT NOT NULL DEFAULT '';

-- -----------------------------------------------------------------------------
-- 2. Seed rig fleet (upsert — รันซ้ำได้)
-- -----------------------------------------------------------------------------
INSERT INTO public.tdl_rigs (rig_id, contractor, mine_id, rig_type, sort_order)
SELECT
  r.rig_id,
  r.contractor,
  (SELECT mine_id FROM public.tdl_mines WHERE code = 'LXML'),
  CASE
    WHEN r.rig_id LIKE 'HE-%' THEN 'HE'
    WHEN r.rig_id LIKE 'H-%'  THEN 'H'
    WHEN r.rig_id LIKE 'SL-%' THEN 'SL'
    ELSE ''
  END,
  r.ord
FROM (VALUES
  ('HE-001', 'Thaidrill',  1),
  ('HE-002', 'Thaidrill',  2),
  ('HE-003', 'Thaidrill',  3),
  ('HE-004', 'Thaidrill',  4),
  ('HE-005', 'Thaidrill',  5),
  ('HE-006', 'Thaidrill',  6),
  ('HE-007', 'Thaidrill',  7),
  ('HE-008', 'Thaidrill',  8),
  ('HE-009', 'Thaidrill',  9),
  ('H-108',  '',           10),
  ('H-112',  '',           11),
  ('H-116',  '',           12),
  ('H-117',  '',           13),
  ('H-118',  '',           14),
  ('H-119',  '',           15),
  ('H-120',  '',           16),
  ('SL-01',  '',           17),
  ('SL-02',  '',           18),
  ('SL-03',  '',           19),
  ('SL-04',  '',           20),
  ('SL-05',  '',           21),
  ('SL-06',  '',           22),
  ('SL-07',  '',           23),
  ('SL-08',  '',           24),
  ('SL-09',  '',           25),
  ('SL-10',  '',           26),
  ('SL-11',  '',           27),
  ('SL-12',  '',           28)
) AS r(rig_id, contractor, ord)
ON CONFLICT (rig_id) DO UPDATE
  SET contractor  = EXCLUDED.contractor,
      sort_order  = EXCLUDED.sort_order,
      updated_at  = now();

-- -----------------------------------------------------------------------------
-- 3. Seed operators (upsert โดยใช้ employee_code เป็น key)
-- -----------------------------------------------------------------------------
INSERT INTO public.tdl_operators (employee_code, display_name, mine_id, is_active)
SELECT
  o.employee_code,
  o.display_name,
  (SELECT mine_id FROM public.tdl_mines WHERE code = 'LXML'),
  true
FROM (VALUES
  ('OP-001', 'B. Khampheng'),
  ('OP-002', 'S. Nouanthavong'),
  ('OP-003', 'V. Phimmasone'),
  ('OP-004', 'T. Bounkham'),
  ('OP-005', 'K. Sengphachanh'),
  ('OP-006', 'P. Vongsay'),
  ('OP-007', 'M. Inthavong'),
  ('OP-008', 'A. Sayasith'),
  ('OP-009', 'J. Latsavong'),
  ('OP-010', 'D. Phomma')
) AS o(employee_code, display_name)
ON CONFLICT DO NOTHING;
