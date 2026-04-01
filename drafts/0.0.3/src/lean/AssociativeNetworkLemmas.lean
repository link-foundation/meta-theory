/-
  AssociativeNetworkLemmas.lean

  Леммы и теоремы о свойствах преобразований ассоциативных сетей.
  Lean 4 перевод AssociativeNetworkLemmas.v (Rocq).
-/
import AssociativeNetworkDefinitions
import AssociativeNetworkConversions
import AssociativeNetworkEquivalence

-- Лемма о сохранении длины кортежей ассоциативной сети
theorem TupleOfLinksDimensionPreserved {l : Nat} (t : TupleOfLinks l) :
    (TupleOfLinksToLinkList t).length = l := by
  simp [TupleOfLinksToLinkList]

-- Лемма о взаимном обращении функций LinkListToTupleOfLinksOption и TupleOfLinksToLinkList
--
-- LinkListToTupleOfLinksInverse доказывает, что каждый кортеж TupleOfLinks без потери данных может быть преобразован в LinkList
-- с помощью TupleOfLinksToLinkList и обратно в TupleOfLinks с помощью LinkListToTupleOfLinksOption.
theorem LinkListToTupleOfLinksInverse (n : Nat) (t : TupleOfLinks n) :
    LinkListToTupleOfLinksOption n (TupleOfLinksToLinkList t) = some t := by
  simp [LinkListToTupleOfLinksOption, TupleOfLinksToLinkList]
  congr 1

/-
  Теорема обёртывания и восстановления ассоциативной сети кортежей:

  ∀ anetvⁿ : Link → Tⁿ, обратно(вперёд(anetvⁿ)) = anetvⁿ.
-/
theorem TupleFunctionEquivalenceAfterTransforms {n : Nat} (anet : AssociativeNetworkTupleFunction n) :
    TupleFunctionEquivalence anet
      (fun id => match LinkListToTupleOfLinksOption n ((TupleFunctionToLinkListFunction anet) id) with
        | some t => t
        | none => anet id) := by
  intro id
  simp [TupleFunctionToLinkListFunction]
  rw [LinkListToTupleOfLinksInverse]

-- Лемма о сохранении длины списков LinkList в ассоциативной сети дуплетов
theorem LinkListDimensionPreserved (offset : Nat) (np : LinkList) :
    np.length = (LinkListToDupletList_ offset np).length := by
  induction np generalizing offset with
  | nil => simp [LinkListToDupletList_]
  | cons n np' ih =>
    cases np' with
    | nil => simp [LinkListToDupletList_]
    | cons m np'' =>
      simp [LinkListToDupletList_]
      exact ih (offset + 1)
