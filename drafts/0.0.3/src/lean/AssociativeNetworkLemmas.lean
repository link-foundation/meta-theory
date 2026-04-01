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
    (TupleOfLinksToNestedPair t).length = l := by
  simp [TupleOfLinksToNestedPair, Vector.toList_length]

-- Лемма о взаимном обращении функций NestedPairToTupleOfLinksOption и TupleOfLinksToNestedPair
--
-- NestedPairToTupleOfLinksInverse доказывает, что каждый кортеж TupleOfLinks без потери данных может быть преобразован в NestedPair
-- с помощью TupleOfLinksToNestedPair и обратно в TupleOfLinks с помощью NestedPairToTupleOfLinksOption.
theorem NestedPairToTupleOfLinksInverse (n : Nat) (t : TupleOfLinks n) :
    NestedPairToTupleOfLinksOption n (TupleOfLinksToNestedPair t) = some t := by
  simp [NestedPairToTupleOfLinksOption, TupleOfLinksToNestedPair, Vector.toList_length]

/-
  Теорема обёртывания и восстановления ассоциативной сети кортежей:

  Пусть дана ассоциативная сеть кортежей длины n, обозначенная как anetvⁿ : Link → Vⁿ.
  Определим операцию отображения этой сети в ассоциативную сеть вложенных упорядоченных пар anetl : Link → NestedPair,
  где NestedPair = {(∅,∅) | (l, np), l ∈ Link, np ∈ NestedPair}.
  Затем определим обратное отображение из ассоциативной сети вложенных упорядоченных пар обратно
  в ассоциативную сеть кортежей длины n.

  Теорема утверждает:

  Для любой ассоциативной сети кортежей длины n, anetvⁿ, применение операции преобразования
  в ассоциативную сеть вложенных упорядоченных пар и обратное преобразование обратно
  в ассоциативную сеть кортежей длины n обеспечивает восстановление исходной сети anetvⁿ.
  Иначе говоря:

  ∀ anetvⁿ : Link → Vⁿ, обратно(вперёд(anetvⁿ)) = anetvⁿ.
-/
theorem TupleFunctionEquivalenceAfterTransforms {n : Nat} (anet : AssociativeNetworkTupleFunction n) :
    TupleFunctionEquivalence anet
      (fun id => match NestedPairToTupleOfLinksOption n ((TupleFunctionToNestedPairFunction anet) id) with
        | some t => t
        | none => anet id) := by
  intro id
  simp [TupleFunctionToNestedPairFunction]
  rw [NestedPairToTupleOfLinksInverse]

-- Лемма о сохранении длины списков NestedPair в ассоциативной сети дуплетов
theorem NestedPairDimensionPreserved (offset : Nat) (np : NestedPair) :
    np.length = (NestedPairToDupletList_ offset np).length := by
  induction np generalizing offset with
  | nil => simp [NestedPairToDupletList_]
  | cons n np' ih =>
    cases np' with
    | nil => simp [NestedPairToDupletList_]
    | cons m np'' =>
      simp [NestedPairToDupletList_]
      exact ih (offset + 1)
