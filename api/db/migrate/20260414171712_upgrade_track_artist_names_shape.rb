class UpgradeTrackArtistNamesShape < ActiveRecord::Migration[8.0]
  # Convert tracks.artist_names from an array of strings (["Name"]) to an array
  # of objects ([{"id": nil, "name": "Name"}]). IDs are filled in later by the
  # tracks backfill rake task; new writes include IDs immediately.
  def up
    execute <<~SQL
      UPDATE tracks
      SET artist_names = COALESCE(
        (
          SELECT jsonb_agg(
            CASE
              WHEN jsonb_typeof(elem) = 'string'
                THEN jsonb_build_object('id', NULL, 'name', elem #>> '{}')
              ELSE elem
            END
          )
          FROM jsonb_array_elements(artist_names) AS elem
        ),
        '[]'::jsonb
      )
      WHERE artist_names IS NOT NULL;
    SQL
  end

  def down
    execute <<~SQL
      UPDATE tracks
      SET artist_names = COALESCE(
        (
          SELECT jsonb_agg(
            CASE
              WHEN jsonb_typeof(elem) = 'object' THEN to_jsonb(elem ->> 'name')
              ELSE elem
            END
          )
          FROM jsonb_array_elements(artist_names) AS elem
        ),
        '[]'::jsonb
      )
      WHERE artist_names IS NOT NULL;
    SQL
  end
end
