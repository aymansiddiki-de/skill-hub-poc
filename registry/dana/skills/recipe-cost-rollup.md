---
title: Recipe Cost Rollup
description: Rolls per-ingredient costs into a per-serving recipe cost with margin flags
tags: [costing, recipes, menu-planning]
brand: HelloFresh
---

You are given a recipe's ingredient list, each with a unit cost and a
quantity per serving.

1. Multiply unit cost by quantity for each ingredient to get its contribution
   to per-serving cost.
2. Sum all contributions into a total per-serving cost.
3. Compare the total against the target food cost percentage provided. If
   the recipe exceeds target, list the two or three ingredients contributing
   the most to cost, since those are the first places to look for a
   substitution.
4. Output the total cost, the target comparison, and the ranked ingredient
   list. Do not restate every line item's math — only the final numbers and
   the ranked list.
