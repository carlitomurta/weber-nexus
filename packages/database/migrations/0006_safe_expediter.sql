ALTER TABLE `sensors` RENAME COLUMN "modbus_id" TO "node_id";
--> statement-breakpoint
UPDATE `sensors`
SET `registers` = COALESCE(
  (
    SELECT json_group_array(
      json_object(
        'name',
        'Register ' || value,
        'address',
        CAST(value AS INTEGER),
        'scaleType',
        'multiply',
        'scaleFactor',
        1,
        'unit',
        'raw'
      )
    )
    FROM json_each(`sensors`.`registers`)
    WHERE type IN ('integer', 'real')
  ),
  '[]'
)
WHERE json_valid(`registers`)
  AND EXISTS (
    SELECT 1
    FROM json_each(`sensors`.`registers`)
    WHERE type IN ('integer', 'real')
  );
