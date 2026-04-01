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

/-
  Лемма о взаимном обращении функций LinkListToTupleOfLinksOption и TupleOfLinksToLinkList

  LinkListToTupleOfLinksInverse доказывает, что каждый кортеж TupleOfLinks без потери данных
  может быть преобразован в LinkList с помощью TupleOfLinksToLinkList и обратно в TupleOfLinks
  с помощью LinkListToTupleOfLinksOption.

  В формальном виде forall n: Nat, forall t: TupleOfLinks n,
  LinkListToTupleOfLinksOption n (TupleOfLinksToLinkList t) = some t говорит о том,
  что для всякого натурального числа n и каждого кортежа TupleOfLinks длины n,
  мы можем преобразовать TupleOfLinks в LinkList с помощью TupleOfLinksToLinkList,
  затем обратно преобразовать результат в TupleOfLinks с помощью LinkListToTupleOfLinksOption n,
  и в итоге получить тот же кортеж TupleOfLinks, что и в начале.

  Это свойство очень важно, потому что оно гарантирует,
  что эти две функции образуют обратную пару на множестве преобразуемых кортежей TupleOfLinks и LinkList.
  Когда вы применяете обе функции к значениям в этом множестве, вы в итоге получаете исходное значение.
  Это означает, что никакая информация не теряется при преобразованиях,
  так что можно свободно конвертировать между TupleOfLinks и LinkList,
  если это требуется в реализации или доказательствах.
-/
theorem LinkListToTupleOfLinksInverse (n : Nat) (t : TupleOfLinks n) :
    LinkListToTupleOfLinksOption n (TupleOfLinksToLinkList t) = some t := by
  simp [LinkListToTupleOfLinksOption, TupleOfLinksToLinkList]
  congr 1

/-
  Теорема обёртывания и восстановления ассоциативной сети кортежей:

  Пусть дана ассоциативная сеть кортежей длины n, обозначенная как anetvⁿ : Link → Tⁿ.
  Определим операцию отображения этой сети в ассоциативную сеть списков ссылок anetl : Link → LinkList,
  где LinkList = {(∅,∅) | (l, ll), l ∈ Link, ll ∈ LinkList}.
  Затем определим обратное отображение из ассоциативной сети списков ссылок обратно
  в ассоциативную сеть кортежей длины n.

  Теорема утверждает:

  Для любой ассоциативной сети кортежей длины n, anetvⁿ, применение операции преобразования
  в ассоциативную сеть списков ссылок и обратное преобразование обратно
  в ассоциативную сеть кортежей длины n обеспечивает восстановление исходной сети anetvⁿ.
  Иначе говоря:

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
