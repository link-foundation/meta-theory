Require Import PeanoNat.
Require Import Coq.Init.Nat.
Require Import Vector.
Require Import List.
Require Import Coq.Init.Datatypes.
Import ListNotations.
Import VectorNotations.
Require Import AssociativeNetworkDefinitions.
Require Import AssociativeNetworkConversions.
Require Import AssociativeNetworkEquivalence.

(* Лемма о сохранении длины кортежей ассоциативной сети *)
Lemma TupleOfLinksDimensionPreserved : forall {l: nat} (t: TupleOfLinks l), List.length (TupleOfLinksToNestedPair t) = l.
Proof.
  intros l t.
  induction t.
  - simpl. reflexivity.
  - simpl. rewrite IHt. reflexivity.
Qed.


(* Лемма о взаимном обращении функций NestedPairToTupleOfLinksOption и TupleOfLinksToNestedPair

   NestedPairToTupleOfLinksInverse доказывает, что каждый кортеж TupleOfLinks без потери данных может быть преобразован в NestedPair
   с помощью TupleOfLinksToNestedPair и обратно в TupleOfLinks с помощью NestedPairToTupleOfLinksOption.

   В формальном виде forall n: nat, forall t: TupleOfLinks n, NestedPairToTupleOfLinksOption n (TupleOfLinksToNestedPair t) = Some t говорит о том,
   что для всякого натурального числа n и каждого кортежа TupleOfLinks длины n,
   мы можем преобразовать TupleOfLinks в NestedPair с помощью TupleOfLinksToNestedPair,
   затем обратно преобразовать результат в TupleOfLinks с помощью NestedPairToTupleOfLinksOption n,
   и в итоге получить тот же кортеж TupleOfLinks, что и в начале.

   Это свойство очень важно, потому что оно гарантирует,
   что эти две функции образуют обратную пару на множестве преобразуемых кортежей TupleOfLinks и NestedPair.
   Когда вы применяете обе функции к значениям в этом множестве, вы в итоге получаете исходное значение.
   Это означает, что никакая информация не теряется при преобразованиях,
   так что можно свободно конвертировать между TupleOfLinks и NestedPair,
   если это требуется в реализации или доказательствах.
*)
Lemma NestedPairToTupleOfLinksInverse: forall n: nat, forall t: TupleOfLinks n, NestedPairToTupleOfLinksOption n (TupleOfLinksToNestedPair t) = Some t.
Proof.
  intros n.
  induction t as [| h n' t' IH].
  - simpl. reflexivity.
  - simpl. rewrite IH. reflexivity.
Qed.


(*
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
*)
Theorem TupleFunctionEquivalenceAfterTransforms : forall {n: nat} (anet: AssociativeNetworkTupleFunction n),
  TupleFunctionEquivalence anet (fun id => match NestedPairToTupleOfLinksOption n ((TupleFunctionToNestedPairFunction anet) id) with
  | Some t => t
  | None => anet id
  end).
Proof.
  intros n net id.
  unfold TupleFunctionToNestedPairFunction.
  simpl.
  rewrite NestedPairToTupleOfLinksInverse.
  reflexivity.
Qed.


(* Лемма о сохранении длины списков NestedPair в ассоциативной сети дуплетов *)
Lemma NestedPairDimensionPreserved : forall (offset: nat) (np: NestedPair),
  length np = length (NestedPairToDupletList_ offset np).
Proof.
  intros offset np.
  generalize dependent offset.
  induction np as [| n np' IHnp']; intros offset.
  - simpl. reflexivity.
  - destruct np' as [| m np'']; simpl; simpl in IHnp'.
  + reflexivity.
  + rewrite IHnp' with (offset := S offset). reflexivity.
Qed.
