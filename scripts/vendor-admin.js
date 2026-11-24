'use strict';

/** Refreshes the self-hosted Supabase browser bundle used by the admin login page. */
const fs = require('fs');
const path = require('path');

const from = path.join(__dirname, '..', 'node_modules', '@supabase', 'supabase-js', 'dist', 'umd', 'supabase.js');
const to = path.join(__dirname, '..', 'admin', 'vendor', 'supabase.js');
fs.mkdirSync(path.dirname(to), { recursive: true });
fs.copyFileSync(from, to);
console.log('Copied', from, '->', to);
