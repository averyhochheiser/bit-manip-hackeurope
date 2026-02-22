
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
    const { data, count, error } = await supabase.from('gate_events').select('*', { count: 'exact' });
    if (error) {
        console.error(error);
        return;
    }
    console.log('Total events:', count);
    console.log('Sample data:', JSON.stringify(data.slice(0, 2), null, 2));

    const repos = Array.from(new Set(data.map(d => d.repo)));
    console.log('Found repos:', repos);
}

check();
