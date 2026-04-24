import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tnuqwmgkxrcxipwfbwua.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRudXF3bWdreHJjeGlwd2Zid3VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzQ1MTg5NzgsImV4cCI6MjA1MDA5NDk3OH0.VZbVv1ICpKCrqr8t7dPj3DxMBZsk0VuPP5keY6BR4H0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  // Son 5 lead
  const { data: leads, error: leadsError } = await supabase
    .from('leads')
    .select('id, service_type, from_plz, status, max_companies, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
    
  console.log('=== SON 5 LEAD ===');
  if (leadsError) console.log('Error:', leadsError);
  leads?.forEach(l => {
    console.log(`ID: ${l.id.substring(0,8)}... | Type: ${l.service_type} | PLZ: ${l.from_plz} | Status: ${l.status} | Max: ${l.max_companies} | Date: ${l.created_at}`);
  });
  
  if (leads && leads.length > 0) {
    const lastLeadId = leads[0].id;
    
    // Bu lead için distributions
    const { data: distributions, error: distError } = await supabase
      .from('lead_distributions')
      .select('id, company_id, status, token_cost')
      .eq('lead_id', lastLeadId);
      
    console.log('\n=== SON LEAD İÇİN DISTRIBUTIONS ===');
    console.log('Lead ID:', lastLeadId.substring(0,8) + '...');
    console.log('Distribution sayısı:', distributions?.length || 0);
    if (distError) console.log('Error:', distError);
    distributions?.forEach(d => {
      console.log(`  Company: ${d.company_id.substring(0,8)}... | Status: ${d.status} | Cost: ${d.token_cost}`);
    });
  }
  
  // Aktif firmalar
  const { data: companies, error: compError } = await supabase
    .from('companies')
    .select('id, name, email, is_active, is_verified, lead_sharing_preference')
    .eq('is_active', true)
    .eq('is_verified', true);
    
  console.log('\n=== AKTİF VE VERIFIED FİRMALAR ===');
  if (compError) console.log('Error:', compError);
  companies?.forEach(c => {
    console.log(`${c.name} (${c.email}) | Pref: ${c.lead_sharing_preference}`);
  });
}

check();
