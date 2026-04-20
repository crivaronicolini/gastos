UPDATE `expenses`
SET `usedByTarget` = (
  SELECT `id`
  FROM `usage_targets`
  WHERE `groupId` = 1
    AND `name` = 'Ambos'
    AND `type` = 'group'
  LIMIT 1
)
WHERE `usedByTarget` IN (
  SELECT `id`
  FROM `usage_targets`
  WHERE `groupId` = 1
    AND `name` = 'Casa'
);

DELETE FROM `usage_targets`
WHERE `groupId` = 1
  AND `name` = 'Casa';

DELETE FROM `group_members`
WHERE `groupId` = 1
  AND `userId` IN (
    SELECT `id`
    FROM `users`
    WHERE `name` = 'Casa'
  );
