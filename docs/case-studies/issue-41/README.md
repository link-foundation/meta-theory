# Case Study: Issue #41 — Polishing of 0.0.3 draft to reduce confusion and reduce number of terms

## Problem Statement

The 0.0.3 draft of the meta-theory article and code contained several terminological inconsistencies that caused confusion:

1. **`Link` defined as `nat`** — A single natural number is a **Reference** (ссылка), not a Link. A Link (связь) is an Association — a full structure like `(Reference: Reference Reference)` or `Reference → (Reference, Reference)`.

2. **`Sequence := Link`** — inconsistent naming. While `LinkSet` and `LinkTree` follow the `Link*` prefix pattern, `Sequence` did not. Renamed to `LinkSequence`.

3. **`NestedPair := list Link`** — misleading name. The type is a `list`, not a `pair`. Renamed to `ReferenceList` since it's a list of references (natural numbers).

4. **`V_n` notation in article** — `V` traditionally denotes vectors or vertices in graph theory. Renamed to `T_n` (T for Tuple) to avoid ambiguity.

5. **Math notation vs links-notation confusion** — The article mixed mathematical notation with links-notation. Mathematical notation uses arrows: `$5 \to (1, 2)$`. Links-notation uses colons: `(5: 1 2)`. These are different and must not be mixed.

6. **Comment asymmetry between Rocq and Lean** — Some Rocq files had extensive comments that were absent in the corresponding Lean files.

7. **Unnecessary CI step** — The "Verification Summary" step added ~5s overhead without providing essential verification.

## Root Cause Analysis

The core issue was that `Link := nat` conflated two distinct concepts:
- **Reference** (ссылка) — a unique identifier/natural number pointing to a tuple
- **Link/Association** (связь) — the full connection structure `(Reference × TupleOfReferences)`

This conflation propagated through all type definitions and code comments, making the theory harder to understand. Additionally, `NestedPair` was a misleading name for what is simply a list of references.

The mathematical notation issue arose from using links-notation format `(id: from to)` in places labeled as "mathematical notation", when the mathematical convention uses function mapping arrows `id → (from, to)`.

## Changes Made

### Iteration 1 (Previous)
- `Sequence` → `LinkSequence`
- `NestedPair` → `LinkList`
- `V_n` → `T_n` in article and code
- Added links-notation references throughout article
- Synchronized Lean and Rocq comments

### Iteration 2 (Current — based on PR review feedback)

#### Core Terminology Rename

| Old Name | New Name | Reason |
|----------|----------|--------|
| `Link := nat` | `Reference := nat` | A nat is a Reference (ссылка), not a Link |
| `LinkDefault` | `ReferenceDefault` | Follows from Reference rename |
| `TupleOfLinks` | `TupleOfReferences` | Tuple of references, not links |
| `TupleOfLinksDefault` | `TupleOfReferencesDefault` | Follows from above |
| `LinkList` | `ReferenceList` | List of references (nat), not links |
| `Duplet := prod Link Link` | `Duplet := prod Reference Reference` | Pair of references |
| `AssociativeNetworkLinkList*` | `AssociativeNetworkReferenceList*` | Follows from ReferenceList |
| `LL` (in math formulas) | `RL` (ReferenceList) | Matches code name |

#### Preserved Names
- `LinkTree` — tree structure for links (associations)
- `LinkSequence := Reference` — sequence identified by a reference to tree root
- `LinkSet := Reference` — set identified by a reference to tree root
- `MetaReference := Reference` — meta-reference is a reference (MetaLink would be a Link/Association at meta level)
- `Association` — kept as is (conceptually = Link)

#### Notation Fix
- Mathematical notation now consistently uses arrows: `$5 \to (1, 2)$`
- Links-notation consistently uses colons: `(5: 1 2)`
- These are explicitly distinguished as different notations

#### CI Improvement
- Removed "Verification Summary" step from CI workflow to speed up iterations

## Files Modified

### Code (14 files)
All 9 Rocq files and 5 Lean files updated with `Reference` terminology:
- `AssociativeNetworkDefinitions.{v,lean}` — core type rename
- `AssociativeNetworkConversions.{v,lean}` — all function names and comments
- `AssociativeNetworkExamples.{v,lean}` — variable names and function calls
- `AssociativeNetworkLemmas.{v,lean}` — theorem names and comments
- `SequenceDefinitions.{v,lean}` — `LinkSequence := Reference`
- `SetDefinitions.{v,lean}` — `LinkSet := Reference`
- `MetaDefinitions.{v,lean}` — `MetaReference := Reference`

### Article (4 files)
- `04-mathematical-introduction.md` — `RL` (ReferenceList) formula
- `05-type-theory-projection.md` — all code snippets updated
- `08-sequences-and-sets.md` — math notation fix, code snippets updated
- `09-meta-theory.md` — level definitions, math notation fix

### CI (1 file)
- `.github/workflows/verification.yml` — removed Verification Summary job

## Term Hierarchy (After Changes)

```
Reference := ℕ₀                           (unique identifier)
TupleOfReferences(n) := Reference^n        (n-tuple of references)
Association(n) := Reference × TupleOfReferences(n)  (= Link/связь conceptually)
Duplet := Reference × Reference            (pair of references)
ReferenceList := List Reference             (list of references)

LinkSequence := Reference                   (reference to tree root)
LinkSet := Reference                        (reference to ordered unique tree root)
LinkTree := Leaf Reference | Node LinkTree LinkTree  (tree structure)

AssociativeNetwork : Reference → Duplet     (the fundamental structure L → L²)
```
