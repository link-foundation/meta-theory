# Case Study: Issue #41 — Polishing of 0.0.3 draft to reduce confusion and reduce number of terms

## Problem Statement

The 0.0.3 draft of the meta-theory article and code contained several terminological inconsistencies that caused confusion:

1. **`Link` defined as `nat`** — while correct for references, the name `Link` was also used as a type alias for `Sequence` and `LinkSet`, which are conceptually different (they are references to tree roots, not just natural numbers).

2. **`Sequence := Link`** — inconsistent naming. While `LinkSet` and `LinkTree` follow the `Link*` prefix pattern, `Sequence` did not. This made it harder to understand the naming convention.

3. **`NestedPair := list Link`** — misleading name. The type is a `list`, not a `pair`. The name "pair" suggests exactly two elements, but this structure can hold any number of elements. It was actually a list of links (references).

4. **`V_n` notation in article** — `V` traditionally denotes vectors (e.g., in physics/linear algebra) or vertices (in graph theory). Using `V` for "set of all n-tuples of links" created ambiguity with the graph theory `V` (vertices) used in the same article. `T` (tuple) is more descriptive.

5. **Missing links-notation references** — The article used only mathematical notation. The [links-notation](https://github.com/link-foundation/links-notation) language `(id: from to)` was only briefly mentioned in the conclusion, but should appear alongside math notation throughout.

6. **Comment asymmetry between Rocq and Lean** — Some Rocq files had extensive comments that were absent or abbreviated in the corresponding Lean files.

## Root Cause Analysis

The issues stem from the organic growth of the theory formalization:
- Early versions used terms borrowed from other domains (e.g., "NestedPair" from set-theoretic tuple representation)
- The naming convention `Link*` was introduced with `LinkSet` and `LinkTree` but not applied retroactively to `Sequence`
- The `V` notation was inherited from early mathematical drafts before the graph theory comparison section was added
- The Lean port was done incrementally, and some comment synchronization was missed

## Changes Made

### Terminology Renames

| Old Name | New Name | Reason |
|----------|----------|--------|
| `Sequence` | `LinkSequence` | Consistent with `LinkSet`, `LinkTree` naming |
| `NestedPair` | `LinkList` | It's a `list Link`, not a pair |
| `AssociativeNetworkNestedPairFunction` | `AssociativeNetworkLinkListFunction` | Follows from `NestedPair` → `LinkList` |
| `AssociativeNetworkNestedPairList` | `AssociativeNetworkLinkListList` | Follows from `NestedPair` → `LinkList` |
| `V_n` (in math formulas) | `T_n` | T for Tuple, avoids ambiguity with V for Vertices |
| `Vⁿ` (in code comments) | `Tⁿ` | Consistent with article |
| `NP` (in math formulas) | `LL` (LinkList) | Consistent with code |

### Links Notation Additions

Added [links-notation](https://github.com/link-foundation/links-notation) references alongside mathematical notation in:
- Section 03 (theory comparison): duplet, triplet, and n-tuple examples
- Section 04 (mathematical introduction): introductory paragraph + duplet definition
- Section 08 (sequences and sets): sequence storage examples
- Section 09 (meta-theory): sequence encoding examples
- Code comments: Duplet definition (Rocq + Lean), sequence headers

### Comment Synchronization

- Expanded Lean `AssociativeNetworkLemmas.lean` comments to match Rocq detail level
- Added links-notation examples to sequence definition headers in both Rocq and Lean

## Files Modified

### Code (Rocq)
- `AssociativeNetworkDefinitions.v` — `NestedPair` → `LinkList`, links-notation comment
- `AssociativeNetworkConversions.v` — all `NestedPair` → `LinkList`
- `AssociativeNetworkEquivalence.v` — no changes needed
- `AssociativeNetworkExamples.v` — all `NestedPair` → `LinkList`
- `AssociativeNetworkLemmas.v` — `NestedPair` → `LinkList`, `Vⁿ` → `Tⁿ`
- `SequenceDefinitions.v` — `Sequence` → `LinkSequence`, links-notation header
- `SetDefinitions.v` — no changes needed (already uses `LinkSet`)
- `MetaDefinitions.v` — comment update for `LinkSequence`
- `SetSequenceEquivalence.v` — no changes needed

### Code (Lean)
- Mirror of all Rocq changes above
- Additional comment expansion in `AssociativeNetworkLemmas.lean`

### Article
- `03-theory-comparison.md` — links-notation for duplets, triplets, n-tuples
- `04-mathematical-introduction.md` — `V_n` → `T_n`, links-notation intro + duplet
- `05-type-theory-projection.md` — `NestedPair` → `LinkList`, `Vⁿ` → `Tⁿ` in code snippets
- `08-sequences-and-sets.md` — `Sequence` → `LinkSequence`, links-notation
- `09-meta-theory.md` — `Sequence` → `LinkSequence`, links-notation

## Term Reduction Summary

The total number of distinct type/concept names was reduced by consolidating the naming pattern:

**Before:** `Link`, `Sequence`, `LinkSet`, `LinkTree`, `NestedPair`, `Duplet`, `TupleOfLinks`
**After:** `Link`, `LinkSequence`, `LinkSet`, `LinkTree`, `LinkList`, `Duplet`, `TupleOfLinks`

The `Link*` prefix now consistently indicates types that are aliases for `Link` (references to tree roots or elements in the associative network).
