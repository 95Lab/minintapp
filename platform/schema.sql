CREATE TABLE IF NOT EXISTS workers (
  id text PRIMARY KEY,
  agent_url text NOT NULL,
  capacity integer NOT NULL CHECK (capacity BETWEEN 1 AND 20),
  heartbeat_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS deployments (
  id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{24}$'),
  owner_id text NOT NULL,
  state text NOT NULL CHECK (state IN ('QUEUED','GENERATING','BUILDING','DEPLOYING','RUNNING','FAILED','SUSPENDED','EXPIRED','DELETED')),
  input jsonb NOT NULL,
  seed jsonb,
  generation jsonb,
  host_token_hash text NOT NULL,
  hostname text NOT NULL UNIQUE,
  image text NOT NULL,
  worker_id text REFERENCES workers(id),
  port integer,
  dns_record_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  queued_at timestamptz
);
ALTER TABLE workers ADD COLUMN IF NOT EXISTS gateway_url text;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS available_images text[] NOT NULL DEFAULT '{}';
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS request_key text;
CREATE UNIQUE INDEX IF NOT EXISTS deployments_idempotency ON deployments(owner_id,request_key);
CREATE INDEX IF NOT EXISTS deployments_worker_state ON deployments(worker_id, state);
CREATE INDEX IF NOT EXISTS deployments_expiry ON deployments(expires_at);
CREATE TABLE IF NOT EXISTS artifacts (
  app_id text REFERENCES deployments(id), version integer NOT NULL,
  spec_digest text NOT NULL, image text NOT NULL,
  PRIMARY KEY(app_id,version)
);
CREATE TABLE IF NOT EXISTS deployment_events (
  id bigserial PRIMARY KEY,
  app_id text REFERENCES deployments(id),
  state text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION record_deployment_state() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' OR OLD.state IS DISTINCT FROM NEW.state THEN
    INSERT INTO deployment_events(app_id,state) VALUES(NEW.id,NEW.state);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS deployment_state_audit ON deployments;
CREATE TRIGGER deployment_state_audit AFTER INSERT OR UPDATE OF state ON deployments
  FOR EACH ROW EXECUTE FUNCTION record_deployment_state();
-- deployments doubles as a transactional outbox: queued_at is written only after queue.add succeeds.
