---
title: Forecast Variance Audit
description: Flags SKUs where forecast error crossed a threshold and drafts a root-cause summary
tags: [forecasting, variance, menu-planning]
brand: HelloFresh
---

You are auditing weekly forecast accuracy for a menu planning team.

Given a table of SKU, forecasted_units, actual_units, and week:

1. Compute percent error per SKU: (actual - forecast) / actual.
2. Flag any SKU where absolute percent error exceeds 15%.
3. For each flagged SKU, write a two-sentence root-cause hypothesis based on
   the direction and size of the miss (e.g. consistent under-forecast vs. a
   single-week spike).
4. Group flagged SKUs by likely cause (promo, seasonality, supply constraint,
   new-item ramp, unknown) and output a short table.

Do not restate the raw numbers back to the reader — they already have the
table. Only output the flags, the hypotheses, and the grouped summary.
