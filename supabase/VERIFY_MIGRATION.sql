-- ============================================================
-- VERIFY_MIGRATION.sql
-- Run this AFTER executing FULL_MIGRATION.sql to verify success
-- ============================================================

-- 1. Check all tables exist
SELECT '✅ TABLES' AS check_type, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('clients_shops', 'bot_settings', 'orders')
ORDER BY table_name;

-- 2. Check RLS is enabled on all tables
SELECT '🔒 RLS STATUS' AS check_type, tablename, 
       CASE WHEN rowsecurity THEN '✅ ENABLED' ELSE '❌ DISABLED' END AS rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('clients_shops', 'bot_settings', 'orders')
ORDER BY tablename;

-- 3. Check all RLS policies are created
SELECT '📋 POLICIES' AS check_type, tablename, policyname, cmd AS operation
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 4. Check Realtime publication includes our tables
SELECT '📡 REALTIME' AS check_type, schemaname || '.' || tablename AS full_table
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename IN ('orders', 'clients_shops');

-- 5. Check indexes are created
SELECT '⚡ INDEXES' AS check_type, indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- 6. Check column details for each table
SELECT '📊 COLUMNS' AS check_type, table_name, column_name, data_type, 
       column_default, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('clients_shops', 'bot_settings', 'orders')
ORDER BY table_name, ordinal_position;

-- 7. Check triggers
SELECT '⏰ TRIGGERS' AS check_type, trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table;
