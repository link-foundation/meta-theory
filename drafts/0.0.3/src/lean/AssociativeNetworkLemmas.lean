/-
  AssociativeNetworkLemmas.lean

  Леммы и теоремы о свойствах преобразований ассоциативных сетей.
  Lean 4 перевод AssociativeNetworkLemmas.v (Rocq).
-/
import AssociativeNetworkDefinitions
import AssociativeNetworkConversions
import AssociativeNetworkEquivalence

-- Лемма о сохранении длины кортежей ассоциативной сети
theorem TupleOfReferencesDimensionPreserved {l : Nat} (t : TupleOfReferences l) :
    (TupleOfReferencesToReferenceList t).length = l := by
  simp [TupleOfReferencesToReferenceList]

/-
  Лемма о взаимном обращении функций ReferenceListToTupleOfReferencesOption и TupleOfReferencesToReferenceList

  ReferenceListToTupleOfReferencesInverse доказывает, что каждый кортеж TupleOfReferences без потери данных
  может быть преобразован в ReferenceList с помощью TupleOfReferencesToReferenceList и обратно в TupleOfReferences
  с помощью ReferenceListToTupleOfReferencesOption.

  В формальном виде forall n: Nat, forall t: TupleOfReferences n,
  ReferenceListToTupleOfReferencesOption n (TupleOfReferencesToReferenceList t) = some t говорит о том,
  что для всякого натурального числа n и каждого кортежа TupleOfReferences длины n,
  мы можем преобразовать TupleOfReferences в ReferenceList с помощью TupleOfReferencesToReferenceList,
  затем обратно преобразовать результат в TupleOfReferences с помощью ReferenceListToTupleOfReferencesOption n,
  и в итоге получить тот же кортеж TupleOfReferences, что и в начале.

  Это свойство очень важно, потому что оно гарантирует,
  что эти две функции образуют обратную пару на множестве преобразуемых кортежей TupleOfReferences и ReferenceList.
  Когда вы применяете обе функции к значениям в этом множестве, вы в итоге получаете исходное значение.
  Это означает, что никакая информация не теряется при преобразованиях,
  так что можно свободно конвертировать между TupleOfReferences и ReferenceList,
  если это требуется в реализации или доказательствах.
-/
theorem ReferenceListToTupleOfReferencesInverse (n : Nat) (t : TupleOfReferences n) :
    ReferenceListToTupleOfReferencesOption n (TupleOfReferencesToReferenceList t) = some t := by
  simp [ReferenceListToTupleOfReferencesOption, TupleOfReferencesToReferenceList]
  congr 1

/-
  Теорема обёртывания и восстановления ассоциативной сети кортежей:

  Пусть дана ассоциативная сеть кортежей длины n, обозначенная как anetvⁿ : Reference → Tⁿ.
  Определим операцию отображения этой сети в ассоциативную сеть списков ссылок anetl : Reference → ReferenceList,
  где ReferenceList = {(∅,∅) | (l, ll), l ∈ Reference, ll ∈ ReferenceList}.
  Затем определим обратное отображение из ассоциативной сети списков ссылок обратно
  в ассоциативную сеть кортежей длины n.

  Теорема утверждает:

  Для любой ассоциативной сети кортежей длины n, anetvⁿ, применение операции преобразования
  в ассоциативную сеть списков ссылок и обратное преобразование обратно
  в ассоциативную сеть кортежей длины n обеспечивает восстановление исходной сети anetvⁿ.
  Иначе говоря:

  ∀ anetvⁿ : Reference → Tⁿ, обратно(вперёд(anetvⁿ)) = anetvⁿ.
-/
theorem TupleFunctionEquivalenceAfterTransforms {n : Nat} (anet : AssociativeNetworkTupleFunction n) :
    TupleFunctionEquivalence anet
      (fun id => match ReferenceListToTupleOfReferencesOption n ((TupleFunctionToReferenceListFunction anet) id) with
        | some t => t
        | none => anet id) := by
  intro id
  simp [TupleFunctionToReferenceListFunction]
  rw [ReferenceListToTupleOfReferencesInverse]

-- Лемма о сохранении длины списков ReferenceList в ассоциативной сети дуплетов
theorem ReferenceListDimensionPreserved (offset : Nat) (np : ReferenceList) :
    np.length = (ReferenceListToDupletList_ offset np).length := by
  induction np generalizing offset with
  | nil => simp [ReferenceListToDupletList_]
  | cons n np' ih =>
    cases np' with
    | nil => simp [ReferenceListToDupletList_]
    | cons m np'' =>
      simp [ReferenceListToDupletList_]
      exact ih (offset + 1)
