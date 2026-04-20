PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS `groups` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL,
  `createdAt` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `group_members` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `groupId` integer REFERENCES `groups`(`id`),
  `userId` integer REFERENCES `users`(`id`),
  `role` text NOT NULL DEFAULT 'member',
  `createdAt` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `usage_targets` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `groupId` integer REFERENCES `groups`(`id`),
  `name` text NOT NULL,
  `type` text NOT NULL,
  `userId` integer REFERENCES `users`(`id`),
  `createdAt` integer NOT NULL
);

INSERT OR IGNORE INTO `groups` (`id`, `name`, `createdAt`) VALUES (1, 'Principal', unixepoch());

INSERT INTO `group_members` (`groupId`, `userId`, `role`, `createdAt`)
SELECT 1, `id`, 'owner', unixepoch()
FROM `users`
WHERE COALESCE(`type`, 'person') = 'person'
  AND `name` != 'Casa'
  AND NOT EXISTS (
    SELECT 1 FROM `group_members`
    WHERE `group_members`.`groupId` = 1
      AND `group_members`.`userId` = `users`.`id`
  );

INSERT INTO `usage_targets` (`groupId`, `name`, `type`, `userId`, `createdAt`)
SELECT 1, `name`, 'member', `id`, unixepoch()
FROM `users`
WHERE COALESCE(`type`, 'person') = 'person'
  AND `name` != 'Casa'
  AND NOT EXISTS (
    SELECT 1 FROM `usage_targets`
    WHERE `usage_targets`.`groupId` = 1
      AND `usage_targets`.`userId` = `users`.`id`
  );

INSERT INTO `usage_targets` (`groupId`, `name`, `type`, `userId`, `createdAt`)
SELECT 1, 'Ambos', 'group', NULL, unixepoch()
WHERE NOT EXISTS (
  SELECT 1 FROM `usage_targets`
  WHERE `groupId` = 1
    AND `name` = 'Ambos'
    AND `type` = 'group'
);

ALTER TABLE `statements` ADD COLUMN `groupId` integer REFERENCES `groups`(`id`);
UPDATE `statements` SET `groupId` = 1 WHERE `groupId` IS NULL;

CREATE TABLE `expenses_new` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `statement` integer REFERENCES `statements`(`id`),
  `origin` text NOT NULL,
  `title` text NOT NULL,
  `amount` numeric,
  `date` integer,
  `installments` text,
  `category` integer REFERENCES `categories`(`id`),
  `usedByTarget` integer REFERENCES `usage_targets`(`id`)
);

INSERT INTO `expenses_new` (
  `id`,
  `statement`,
  `origin`,
  `title`,
  `amount`,
  `date`,
  `installments`,
  `category`,
  `usedByTarget`
)
SELECT
  `expenses`.`id`,
  `expenses`.`statement`,
  `expenses`.`origin`,
  `expenses`.`title`,
  `expenses`.`amount`,
  `expenses`.`date`,
  `expenses`.`installments`,
  `expenses`.`category`,
  CASE
    WHEN `expenses`.`usedBy` IS NULL THEN NULL
    ELSE COALESCE(
      (
        SELECT `usage_targets`.`id`
        FROM `usage_targets`
        WHERE `usage_targets`.`groupId` = 1
          AND `usage_targets`.`userId` = `expenses`.`usedBy`
        LIMIT 1
      ),
      (
        SELECT `usage_targets`.`id`
        FROM `usage_targets`
        WHERE `usage_targets`.`groupId` = 1
          AND `usage_targets`.`name` = 'Ambos'
          AND `usage_targets`.`type` = 'group'
        LIMIT 1
      )
    )
  END
FROM `expenses`;

DROP TABLE `expenses`;
ALTER TABLE `expenses_new` RENAME TO `expenses`;

DELETE FROM `users` WHERE `name` = 'Ambos' AND COALESCE(`type`, 'person') = 'group';

PRAGMA foreign_keys = ON;
