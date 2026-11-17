# Graph Report - c:\Users\Regondi Calidad\Desktop\QM\FuelTrack  (2026-11-17)

## Corpus Check
- Corpus is ~10,194 words - fits in a single context window. You may not need a graph.

## Summary
- 118 nodes · 229 edges · 12 communities (10 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10

## God Nodes (most connected - your core abstractions)
1. `runAllTests()` - 20 edges
2. `attachEventListeners()` - 13 edges
3. `keywords` - 11 edges
4. `seedDemoData()` - 11 edges
5. `renderApp()` - 11 edges
6. `formatLiters()` - 10 edges
7. `purgeDemoData()` - 8 edges
8. `iconSvg()` - 8 edges
9. `CompartmentSealAuditorEngine` - 8 edges
10. `FuelLiterLedgerService` - 8 edges

## Surprising Connections (you probably didn't know these)
- `runAllTests()` --calls--> `seedDemoData()`  [EXTRACTED]
  tests/run_tests.js → src/app.js
- `runAllTests()` --calls--> `purgeDemoData()`  [EXTRACTED]
  tests/run_tests.js → src/app.js
- `runAllTests()` --references--> `FuelTrackCache`  [EXTRACTED]
  tests/run_tests.js → src/services/fuelTrackCache.service.js
- `runAllTests()` --calls--> `sealFuelDeliveryEPOD()`  [EXTRACTED]
  tests/run_tests.js → src/utils/cryptoSeal.js
- `runAllTests()` --calls--> `formatCurrency()`  [EXTRACTED]
  tests/run_tests.js → src/utils/formatters.js

## Import Cycles
- None detected.

## Communities (12 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.23
Nodes (17): auditorEngine, getAvailableCompartments(), hasDemoRecords(), iconSvg(), ledgerService, renderAccountsView(), renderActiveView(), renderApp() (+9 more)

### Community 1 - "Community 1"
Cohesion: 0.24
Nodes (5): computeCurrentCompensator(), ThermalFuelCompensatorEngine, FuelLiterLedgerService, assert(), runAllTests()

### Community 2 - "Community 2"
Cohesion: 0.23
Nodes (9): state, FUEL_TYPES, computeSHA256(), sealFuelDeliveryEPOD(), formatCurrency(), formatDate(), __dirname, __filename (+1 more)

### Community 3 - "Community 3"
Cohesion: 0.17
Nodes (11): background_color, description, display, icons, lang, name, orientation, scope (+3 more)

### Community 4 - "Community 4"
Cohesion: 0.17
Nodes (11): author, description, license, name, scripts, security:full, test, test:security (+3 more)

### Community 5 - "Community 5"
Cohesion: 0.29
Nodes (10): attachEventListeners(), isDemoPurged(), persistState(), purgeDemoData(), restoreDemoData(), seedDemoData(), setDemoPurgedFlag(), syncEnginesFromState() (+2 more)

### Community 6 - "Community 6"
Cohesion: 0.18
Nodes (11): keywords, agro, caudalimetro, cisternas, combustibles, compensacion-termica, gasoil, icl-idc (+3 more)

### Community 7 - "Community 7"
Cohesion: 0.29
Nodes (6): app, [maj, min, patch], nextPatch, pkg, sw, v

### Community 8 - "Community 8"
Cohesion: 0.33
Nodes (5): __dirname, __filename, mime, root, server

## Knowledge Gaps
- **49 isolated node(s):** `name`, `short_name`, `description`, `start_url`, `scope` (+44 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `runAllTests()` connect `Community 1` to `Community 0`, `Community 9`, `Community 2`, `Community 5`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `CompartmentSealAuditorEngine` connect `Community 9` to `Community 0`, `Community 2`, `Community 5`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Why does `keywords` connect `Community 6` to `Community 4`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **What connects `name`, `short_name`, `description` to the rest of the system?**
  _49 weakly-connected nodes found - possible documentation gaps or missing edges._