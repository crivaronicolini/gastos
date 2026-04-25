CREATE TABLE `account` (
	`id` text PRIMARY KEY,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_account_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL UNIQUE,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`timezone` text,
	`city` text,
	`country` text,
	`region` text,
	`region_code` text,
	`colo` text,
	`latitude` text,
	`longitude` text,
	CONSTRAINT `fk_session_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`email` text NOT NULL UNIQUE,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`statement` integer,
	`origin` text NOT NULL,
	`title` text NOT NULL,
	`amount` numeric,
	`currency` text DEFAULT 'ARS' NOT NULL,
	`date` integer,
	`installments` text,
	`category` integer,
	`usedByTarget` integer,
	CONSTRAINT `fk_expenses_statement_statements_id_fk` FOREIGN KEY (`statement`) REFERENCES `statements`(`id`),
	CONSTRAINT `fk_expenses_category_categories_id_fk` FOREIGN KEY (`category`) REFERENCES `categories`(`id`),
	CONSTRAINT `fk_expenses_usedByTarget_usage_targets_id_fk` FOREIGN KEY (`usedByTarget`) REFERENCES `usage_targets`(`id`)
);
--> statement-breakpoint
CREATE TABLE `group_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`groupId` integer,
	`userId` integer,
	`role` text DEFAULT 'member' NOT NULL,
	`createdAt` integer NOT NULL,
	CONSTRAINT `fk_group_members_groupId_groups_id_fk` FOREIGN KEY (`groupId`) REFERENCES `groups`(`id`),
	CONSTRAINT `fk_group_members_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `statements` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`groupId` integer,
	`bank` text,
	`card` text,
	`owner` integer,
	`periodFrom` integer,
	`periodTo` integer,
	`month` text,
	`sourceFileKey` text,
	`jsonFileKey` text,
	`createdAt` integer NOT NULL,
	CONSTRAINT `fk_statements_groupId_groups_id_fk` FOREIGN KEY (`groupId`) REFERENCES `groups`(`id`),
	CONSTRAINT `fk_statements_owner_users_id_fk` FOREIGN KEY (`owner`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `usage_targets` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`groupId` integer,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`userId` integer,
	`createdAt` integer NOT NULL,
	CONSTRAINT `fk_usage_targets_groupId_groups_id_fk` FOREIGN KEY (`groupId`) REFERENCES `groups`(`id`),
	CONSTRAINT `fk_usage_targets_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`name` text NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);