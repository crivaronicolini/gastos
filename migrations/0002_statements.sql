CREATE TABLE IF NOT EXISTS `statements` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `bank` text,
  `card` text,
  `owner` integer REFERENCES `users`(`id`),
  `periodFrom` integer,
  `periodTo` integer,
  `month` text,
  `sourceFileKey` text,
  `jsonFileKey` text,
  `createdAt` integer NOT NULL
);

ALTER TABLE `expenses` ADD COLUMN `statement` integer REFERENCES `statements`(`id`);
