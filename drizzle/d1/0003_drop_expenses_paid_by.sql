PRAGMA foreign_keys = OFF;

CREATE TABLE `expenses_new` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `statement` integer REFERENCES `statements`(`id`),
  `origin` text NOT NULL,
  `title` text NOT NULL,
  `amount` numeric,
  `date` integer,
  `installments` text,
  `category` integer REFERENCES `categories`(`id`),
  `usedBy` integer REFERENCES `users`(`id`)
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
  `usedBy`
)
SELECT
  `id`,
  `statement`,
  `origin`,
  `title`,
  `amount`,
  `date`,
  `installments`,
  `category`,
  `usedBy`
FROM `expenses`;

DROP TABLE `expenses`;
ALTER TABLE `expenses_new` RENAME TO `expenses`;

PRAGMA foreign_keys = ON;
