PRAGMA foreign_keys = OFF;

DELETE FROM `expenses`
WHERE `usedByTarget` IN (
  SELECT `usage_targets`.`id`
  FROM `usage_targets`
  JOIN `users` ON `users`.`id` = `usage_targets`.`userId`
  WHERE `users`.`name` = 'Marco Crivaro Nicolini'
);

DELETE FROM `expenses`
WHERE `statement` IN (
  SELECT `statements`.`id`
  FROM `statements`
  JOIN `users` ON `users`.`id` = `statements`.`owner`
  WHERE `users`.`name` = 'Marco Crivaro Nicolini'
);

DELETE FROM `usage_targets`
WHERE `userId` IN (
  SELECT `id`
  FROM `users`
  WHERE `name` = 'Marco Crivaro Nicolini'
);

DELETE FROM `group_members`
WHERE `userId` IN (
  SELECT `id`
  FROM `users`
  WHERE `name` = 'Marco Crivaro Nicolini'
);

DELETE FROM `statements`
WHERE `owner` IN (
  SELECT `id`
  FROM `users`
  WHERE `name` = 'Marco Crivaro Nicolini'
);

DELETE FROM `users`
WHERE `name` = 'Marco Crivaro Nicolini';

PRAGMA foreign_keys = ON;
