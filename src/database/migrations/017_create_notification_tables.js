export const up = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS notification_preferences (
      user_id        INTEGER     PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      report_enabled BOOLEAN    NOT NULL DEFAULT false,
      frequency      VARCHAR(20) NOT NULL DEFAULT 'daily',   -- daily | weekly
      send_hour      SMALLINT    NOT NULL DEFAULT 8           CHECK (send_hour BETWEEN 0 AND 23),
      send_minute    SMALLINT    NOT NULL DEFAULT 0           CHECK (send_minute BETWEEN 0 AND 59),
      send_day       SMALLINT    NOT NULL DEFAULT 1           CHECK (send_day BETWEEN 1 AND 7),
      report_type    VARCHAR(20) NOT NULL DEFAULT 'summary',  -- summary | detailed
      created_at     TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
      updated_at     TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notification_logs (
      id              SERIAL    PRIMARY KEY,
      user_id         INTEGER   REFERENCES users(id) ON DELETE SET NULL,
      type            VARCHAR(50) NOT NULL,   -- daily_report | weekly_report | test
      sent_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status          VARCHAR(20) NOT NULL,   -- sent | failed
      error_message   TEXT,
      telegram_msg_id BIGINT
    );

    CREATE INDEX IF NOT EXISTS idx_notif_logs_user_id ON notification_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_notif_logs_sent_at ON notification_logs(sent_at DESC);
  `);
  console.log('✓ Created notification_preferences and notification_logs tables');
};

export const down = async (client) => {
  await client.query(`
    DROP INDEX IF EXISTS idx_notif_logs_sent_at;
    DROP INDEX IF EXISTS idx_notif_logs_user_id;
    DROP TABLE IF EXISTS notification_logs;
    DROP TABLE IF EXISTS notification_preferences;
  `);
  console.log('✓ Dropped notification tables');
};
