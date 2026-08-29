/* ── AI extraction pricing — flat per TASK, not per document ──
   Keyed by a BUNDLES id (forms-data.js), plus 'default' for the root
   page's free-form selections that don't exactly match any bundle. This
   is the FRONTEND's copy, used only to LABEL the price before a call is
   even made — the Worker (worker/src/index.js) holds its own copy and is
   what actually decides what to charge; a client can never talk it into
   charging less than this table says. The two copies are kept in sync by
   test/task-pricing-contract.test.js, not by literal code sharing (the
   Worker is a separate deployable and can't <script src> this file) —
   same pattern PROMPTS/AI_FIELD_MAP already use, see
   test/worker-frontend-contract.test.js.

   b_transfer needs two extractions (RC + buyer's Aadhaar) so it's priced
   higher; every other task needs at most one (just the RC).

   Deliberately its own file with zero dependencies (not folded into
   forms-data.js, which needs pdf-generate.js's addFormXX functions already
   defined just to evaluate PICKS) — so test/task-pricing-contract.test.js
   can require() it directly without dragging in the rest of the frontend
   bootstrap. Load order: after forms-data.js (BUNDLES ids should stay in
   sync by eye), before ui.js/pro-wallet.js (both read this). */
const TASK_PRICING={
  b_transfer: 500,
  b_rcrenew:  300,
  b_duprc:    300,
  b_death:    300,
  b_hp:       300,
  b_hpremove: 300,
  b_address:  300,
  b_newreg:   300,
  default:    300,
};

if(typeof module!=='undefined' && module.exports){
  module.exports={ TASK_PRICING };
}
