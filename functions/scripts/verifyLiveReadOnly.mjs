/**
 * Live Read-Only Verification Script for FICUP 26/27 (ficup-c9186)
 *
 * Run once IAM roles/datastore.viewer is granted to the ADC / dedicated service account:
 *   cd functions && npm run verify:live
 *
 * Performs ONLY .get() reads on strictly whitelisted documents. Never writes.
 */
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const OFFICIAL_PROJECT_ID = 'ficup-c9186';
const WHITELISTED_DOCS = [
  'club_directory/public_list',
  'classifiche_serie/serie_a',
  'classifiche_serie/serie_b',
  'classifiche_serie/lega_pro_a',
  'classifiche_serie/lega_pro_b',
  'classifiche_serie/lega_pro_c',
  'superlega_top10/main_data',
  'superlega_top10/giornata_1',
  'zonavar_public_state/current',
  'comunicati_db/main_data',
];

async function main() {
  console.log(`Verifica sola lettura verso ${OFFICIAL_PROJECT_ID} / (default) via ADC...`);

  const app =
    getApps().find((a) => a.name === 'live-verify') ??
    initializeApp({ credential: applicationDefault(), projectId: OFFICIAL_PROJECT_ID }, 'live-verify');

  const db = getFirestore(app, '(default)');

  for (const path of WHITELISTED_DOCS) {
    try {
      const snap = await db.doc(path).get();
      if (!snap.exists) {
        console.log(`[MISSING] ${path} -> documento assente su ${OFFICIAL_PROJECT_ID}`);
      } else {
        const data = snap.data() || {};
        const keys = Object.keys(data);
        console.log(`[OK] ${path} -> ${keys.length} campi top-level (${keys.join(', ')})`);
      }
    } catch (err) {
      const anyErr = err as { code?: unknown; message?: string };
      console.error(`[ERROR] ${path} -> code=${String(anyErr?.code ?? 'UNKNOWN')} message=${anyErr?.message ?? String(err)}`);
    }
  }
}

main().catch((err) => {
  console.error('Verifica fallita:', err);
  process.exitCode = 1;
});
