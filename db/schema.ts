import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
export const runs = sqliteTable('runs', {
 id: text('id').primaryKey(), day: text('day').notNull(), player: text('player').notNull(),
 cursor: integer('cursor').notNull().default(0), score: integer('score').notNull().default(0),
 answers: text('answers').notNull().default('[]'), completed: integer('completed').notNull().default(0),
 createdAt: text('created_at').notNull(),
}, t => [index('runs_day_completed').on(t.day,t.completed)]);

export const questions = sqliteTable('questions', {
 id: text('id').primaryKey(), payload: text('payload').notNull(), status: text('status').notNull().default('draft'),
 fingerprint: text('fingerprint').notNull().unique(), revision: integer('revision').notNull().default(1),
 createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
});
export const dayRounds = sqliteTable('day_rounds', {
 day: text('day').primaryKey(), questions: text('questions').notNull(), scoreVersion: integer('score_version').notNull(),
 origin: text('origin').notNull(), updatedAt: text('updated_at').notNull(),
});
export const adminSettings = sqliteTable('admin_settings', {key:text('key').primaryKey(),value:text('value').notNull()});
export const adminAudit = sqliteTable('admin_audit', {
 id:text('id').primaryKey(),actor:text('actor').notNull(),action:text('action').notNull(),target:text('target').notNull(),createdAt:text('created_at').notNull(),
});
