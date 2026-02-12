-- Single source of truth for authentication email: people.email
-- 1) Normalize + backfill people.email from users.email when missing
UPDATE public.people AS p
SET email = lower(btrim(u.email))
FROM public.users AS u
WHERE u.person_id = p.id
  AND u.email IS NOT NULL
  AND (p.email IS NULL OR btrim(p.email) = '');

-- 2) Normalize existing people.email values
UPDATE public.people
SET email = NULLIF(lower(btrim(email)), '')
WHERE email IS NOT NULL;

-- 3) Ensure uniqueness before adding constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT lower(email) AS normalized_email
      FROM public.people
      WHERE email IS NOT NULL
      GROUP BY lower(email)
      HAVING COUNT(*) > 1
    ) AS duplicates
  ) THEN
    RAISE EXCEPTION 'Cannot migrate: duplicate emails exist in public.people';
  END IF;
END
$$;

-- 4) Move unique constraint to people.email
ALTER TABLE public.people
ADD CONSTRAINT people_email_key UNIQUE (email);

-- 5) Remove duplicated email column from users
ALTER TABLE public.users
DROP COLUMN email;
