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

(* Лемма о сохранении длины векторов ассоциативной сети *)
Lemma VectorOfLinksDimensionPreserved : forall {l: nat} (t: VectorOfLinks l), List.length (VectorOfLinksToNestedPair t) = l.
Proof.
  intros l t.
  induction t.
  - simpl. reflexivity.
  - simpl. rewrite IHt. reflexivity.
Qed.


(* Лемма о взаимном обращении функций NestedPairToVectorOfLinksOption и VectorOfLinksToNestedPair

   NestedPairToVectorOfLinksInverse доказывает, что каждый вектор VectorOfLinks без потери данных может быть преобразован в NestedPair
   с помощью VectorOfLinksToNestedPair и обратно в VectorOfLinks с помощью NestedPairToVectorOfLinksOption.

   В формальном виде forall n: nat, forall t: VectorOfLinks n, NestedPairToVectorOfLinksOption n (VectorOfLinksToNestedPair t) = Some t говорит о том,
   что для всякого натурального числа n и каждого вектора VectorOfLinks длины n,
   мы можем преобразовать VectorOfLinks в NestedPair с помощью VectorOfLinksToNestedPair,
   затем обратно преобразовать результат в VectorOfLinks с помощью NestedPairToVectorOfLinksOption n,
   и в итоге получить тот же вектор VectorOfLinks, что и в начале.

   Это свойство очень важно, потому что оно гарантирует,
   что эти две функции образуют обратную пару на множестве преобразуемых векторов VectorOfLinks и NestedPair.
   Когда вы применяете обе функции к значениям в этом множестве, вы в итоге получаете исходное значение.
   Это означает, что никакая информация не теряется при преобразованиях,
   так что можно свободно конвертировать между VectorOfLinks и NestedPair,
   если это требуется в реализации или доказательствах.
*)
Lemma NestedPairToVectorOfLinksInverse: forall n: nat, forall t: VectorOfLinks n, NestedPairToVectorOfLinksOption n (VectorOfLinksToNestedPair t) = Some t.
Proof.
  intros n.
  induction t as [| h n' t' IH].
  - simpl. reflexivity.
  - simpl. rewrite IH. reflexivity.
Qed.


(*
  Теорема обёртывания и восстановления ассоциативной сети векторов:

  Пусть дана ассоциативная сеть векторов длины n, обозначенная как anetvⁿ : Link → Vⁿ.
  Определим операцию отображения этой сети в ассоциативную сеть вложенных упорядоченных пар anetl : Link → NestedPair,
  где NestedPair = {(∅,∅) | (l, np), l ∈ Link, np ∈ NestedPair}.
  Затем определим обратное отображение из ассоциативной сети вложенных упорядоченных пар обратно
  в ассоциативную сеть векторов длины n.

  Теорема утверждает:

  Для любой ассоциативной сети векторов длины n, anetvⁿ, применение операции преобразования
  в ассоциативную сеть вложенных упорядоченных пар и обратное преобразование обратно
  в ассоциативную сеть векторов длины n обеспечивает восстановление исходной сети anetvⁿ.
  Иначе говоря:

  ∀ anetvⁿ : Link → Vⁿ, обратно(вперёд(anetvⁿ)) = anetvⁿ.
*)
Theorem VectorFunctionEquivalenceAfterTransforms : forall {n: nat} (anet: AssociativeNetworkVectorFunction n),
  VectorFunctionEquivalence anet (fun id => match NestedPairToVectorOfLinksOption n ((VectorFunctionToNestedPairFunction anet) id) with
  | Some t => t
  | None => anet id
  end).
Proof.
  intros n net id.
  unfold VectorFunctionToNestedPairFunction.
  simpl.
  rewrite NestedPairToVectorOfLinksInverse.
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
