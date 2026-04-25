PRAGMA foreign_keys = OFF;

DELETE FROM `expenses`
WHERE `usedByTarget` IN (
  SELECT `usage_targets`.`id`
  FROM `usage_targets`
  JOIN `users` ON `users`.`id` = `usage_targets`.`userId`
  WHERE UPPER(`users`.`name`) = 'MARCO CRIVARO NICOLINI'
);

DELETE FROM `expenses`
WHERE `statement` IN (
  SELECT `statements`.`id`
  FROM `statements`
  JOIN `users` ON `users`.`id` = `statements`.`owner`
  WHERE UPPER(`users`.`name`) = 'MARCO CRIVARO NICOLINI'
);

DELETE FROM `usage_targets`
WHERE `userId` IN (
  SELECT `id`
  FROM `users`
  WHERE UPPER(`name`) = 'MARCO CRIVARO NICOLINI'
);

DELETE FROM `group_members`
WHERE `userId` IN (
  SELECT `id`
  FROM `users`
  WHERE UPPER(`name`) = 'MARCO CRIVARO NICOLINI'
);

DELETE FROM `statements`
WHERE `owner` IN (
  SELECT `id`
  FROM `users`
  WHERE UPPER(`name`) = 'MARCO CRIVARO NICOLINI'
);

DELETE FROM `users`
WHERE UPPER(`name`) = 'MARCO CRIVARO NICOLINI';

PRAGMA foreign_keys = ON;
