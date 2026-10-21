INSERT INTO people (id, name, role, focus, email) VALUES ('ayman', 'Ayman Siddiki', 'Supply Chain Planning Analyst', 'Forecasting, automation, menu planning', 'ayman@example.com');
INSERT INTO people (id, name, role, focus, email) VALUES ('dana', 'Dana Whitfield', 'US Menu Planning Analyst', 'Recipe costing, SKU rationalization', 'dana@example.com');
INSERT INTO skills (id, author, title, description, tags, body) VALUES ('forecast-variance-audit', 'ayman', 'Forecast Variance Audit', 'Flags SKUs where forecast error crossed a threshold and drafts a root-cause summary', '["forecasting", "variance", "menu-planning"]', 'You are auditing weekly forecast accuracy for a menu planning team.

Given a table of SKU, forecasted_units, actual_units, and week:

1. Compute percent error per SKU: (actual - forecast) / actual.
2. Flag any SKU where absolute percent error exceeds 15%.
3. For each flagged SKU, write a two-sentence root-cause hypothesis based on
   the direction and size of the miss (e.g. consistent under-forecast vs. a
   single-week spike).
4. Group flagged SKUs by likely cause (promo, seasonality, supply constraint,
   new-item ramp, unknown) and output a short table.

Do not restate the raw numbers back to the reader — they already have the
table. Only output the flags, the hypotheses, and the grouped summary.');
INSERT INTO artifacts (id, author, title, description, url) VALUES ('lead-time-buffer-calculator', 'ayman', 'Safety Stock Buffer', 'Computes a safety stock buffer from demand variability and lead time', 'https://claude.ai/artifact/2qVpk3kPKUeE9VxLBAdfxD');
INSERT INTO skills (id, author, title, description, tags, body) VALUES ('recipe-cost-rollup', 'dana', 'Recipe Cost Rollup', 'Rolls per-ingredient costs into a per-serving recipe cost with margin flags', '["costing", "recipes", "menu-planning"]', 'You are given a recipe''s ingredient list, each with a unit cost and a
quantity per serving.

1. Multiply unit cost by quantity for each ingredient to get its contribution
   to per-serving cost.
2. Sum all contributions into a total per-serving cost.
3. Compare the total against the target food cost percentage provided. If
   the recipe exceeds target, list the two or three ingredients contributing
   the most to cost, since those are the first places to look for a
   substitution.
4. Output the total cost, the target comparison, and the ranked ingredient
   list. Do not restate every line item''s math — only the final numbers and
   the ranked list.');
INSERT INTO artifacts (id, author, title, description, url) VALUES ('sku-rationalization-grid', 'dana', 'SKU Rationalization Grid', 'Flags SKUs as keep, watch, or cut based on repeat rate and margin', 'https://claude.ai/artifact/Vrrm83DPmNYQtnNVvp5hrh');
