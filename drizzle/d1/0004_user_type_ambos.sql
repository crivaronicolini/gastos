ALTER TABLE `users` ADD COLUMN `type` text NOT NULL DEFAULT 'person';

INSERT OR IGNORE INTO `users` (`name`, `type`) VALUES ('Ambos', 'group');
