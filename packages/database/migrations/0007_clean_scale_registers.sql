UPDATE `sensors`
SET `registers` = COALESCE(
  (
    SELECT json_group_array(
      json_object(
        'name',
        COALESCE(json_extract(value, '$.name'), 'Register ' || json_extract(value, '$.address')),
        'address',
        CAST(json_extract(value, '$.address') AS INTEGER),
        'scaleType',
        COALESCE(json_extract(value, '$.scaleType'), 'multiply'),
        'scaleFactor',
        COALESCE(json_extract(value, '$.scaleFactor'), json_extract(value, '$.scale'), 1),
        'unit',
        COALESCE(json_extract(value, '$.unit'), 'raw')
      )
    )
    FROM json_each(`sensors`.`registers`)
    WHERE type = 'object'
  ),
  '[]'
)
WHERE json_valid(`registers`)
  AND EXISTS (
    SELECT 1
    FROM json_each(`sensors`.`registers`)
    WHERE type = 'object'
      AND json_extract(value, '$.scale') IS NOT NULL
      AND json_extract(value, '$.scaleType') IS NULL
  );
