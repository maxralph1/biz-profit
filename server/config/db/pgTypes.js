import pg from 'pg';
pg.types.setTypeParser(1082, (v) => v);   // 1082 = DATE