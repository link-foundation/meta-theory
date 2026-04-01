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
  simp [TupleOfLinksToNestedPair]
  exact t.toList_length

-- Лемма о взаимном обращении функций NestedPairToTupleOfLinksOption и TupleOfLinksToNestedPair
--
-- NestedPairToTupleOfLinksInverse доказывает, что каждый кортеж TupleOfLinks без потери данных может быть преобразован в NestedPair
-- с помощью TupleOfLinksToNestedPair и обратно в TupleOfLinks с помощью NestedPairToTupleOfLinksOption.
--
-- В формальном виде forall n: nat, forall t: TupleOfLinks n, NestedPairToTupleOfLinksOption n (TupleOfLinksToNestedPair t) = Some t говорит о том,
-- что для всякого натурального числа n и каждого кортежа TupleOfLinks длины n,
-- мы можем преобразовать TupleOfLinks в NestedPair с помощью TupleOfLinksToNestedPair,
-- затем обратно преобразовать результат в TupleOfLinks с помощью NestedPairToTupleOfLinksOption n,
-- и в итоге получить тот же кортеж TupleOfLinks, что и в начале.
--
-- Это свойство очень важно, потому что оно гарантирует,
-- что эти две функции образуют обратную пару на множестве преобразуемых кортежей TupleOfLinks и NestedPair.
-- Когда вы применяете обе функции к значениям в этом множестве, вы в итоге получаете исходное значение.
-- Это означает, что никакая информация не теряется при преобразованиях,
-- так что можно свободно конвертировать между TupleOfLinks и NestedPair,
-- если это требуется в реализации или доказательствах.
theorem NestedPairToTupleOfLinksInverse (n : Nat) (t : TupleOfLinks n) :
    NestedPairToTupleOfLinksOption n (TupleOfLinksToNestedPair t) = some t := by
  simp [NestedPairToTupleOfLinksOption, TupleOfLinksToNestedPair]
  simp [t.toList_length]
  exact Vector.toList_injective.eq_iff.mpr rfl |>.symm ▸ rfl

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
