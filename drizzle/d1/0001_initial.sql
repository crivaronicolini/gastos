CREATE TABLE IF NOT EXISTS `categories` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS `users` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS `expenses` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `origin` text NOT NULL,
  `title` text NOT NULL,
  `amount` numeric,
  `date` integer,
  `installments` text,
  `category` integer REFERENCES `categories`(`id`),
  `usedBy` integer REFERENCES `users`(`id`),
  `paidBy` integer REFERENCES `users`(`id`)
);
