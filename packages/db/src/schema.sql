CREATE TABLE
  IF NOT EXISTS deployments (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'pending',
    source_type TEXT NOT NULL,
    source_url TEXT,
    image_tag TEXT,
    container_id TEXT,
    port INTEGER,
    live_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

CREATE TABLE
  IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    deployment_id TEXT NOT NULL REFERENCES deployments (id),
    stream TEXT NOT NULL,
    line TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );