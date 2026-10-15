export const up = async (client) => {
  await client.query(`
    ALTER TABLE share_links
      ADD COLUMN IF NOT EXISTS slug VARCHAR(100) NULL UNIQUE;

    CREATE UNIQUE INDEX IF NOT EXISTS idx_share_links_slug
      ON share_links(slug)
      WHERE slug IS NOT NULL;
  `);
  console.log('✓ Added slug column to share_links');
};

export const down = async (client) => {
  await client.query(`
    DROP INDEX IF EXISTS idx_share_links_slug;
    ALTER TABLE share_links DROP COLUMN IF EXISTS slug;
  `);
  console.log('✓ Removed slug column from share_links');
};
