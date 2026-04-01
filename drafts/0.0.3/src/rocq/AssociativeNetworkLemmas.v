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
Lemma TupleOfLinksDimensionPreserved : forall {l: nat} (t: TupleOfLinks l), List.length (TupleOfLinksToLinkList t) = l.
Proof.
  intros l t.
  induction t.
  - simpl. reflexivity.
  - simpl. rewrite IHt. reflexivity.
Qed.


(* Лемма о взаимном обращении функций LinkListToTupleOfLinksOption и TupleOfLinksToLinkList

   LinkListToTupleOfLinksInverse доказывает, что каждый кортеж TupleOfLinks без потери данных может быть преобразован в LinkList
   с помощью TupleOfLinksToLinkList и обратно в TupleOfLinks с помощью LinkListToTupleOfLinksOption.

   В формальном виде forall n: nat, forall t: TupleOfLinks n, LinkListToTupleOfLinksOption n (TupleOfLinksToLinkList t) = Some t говорит о том,
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
*)
Lemma LinkListToTupleOfLinksInverse: forall n: nat, forall t: TupleOfLinks n, LinkListToTupleOfLinksOption n (TupleOfLinksToLinkList t) = Some t.
Proof.
  intros n.
  induction t as [| h n' t' IH].
  - simpl. reflexivity.
  - simpl. rewrite IH. reflexivity.
Qed.


(*
  Теорема обёртывания и восстановления ассоциативной сети кортежей:

  Пусть дана ассоциативная сеть кортежей длины n, обозначенная как anetvⁿ : Link → Tⁿ.
  Определим операцию отображения этой сети в ассоциативную сеть вложенных упорядоченных пар anetl : Link → LinkList,
  где LinkList = {(∅,∅) | (l, np), l ∈ Link, np ∈ LinkList}.
  Затем определим обратное отображение из ассоциативной сети вложенных упорядоченных пар обратно
  в ассоциативную сеть кортежей длины n.

  Теорема утверждает:

  Для любой ассоциативной сети кортежей длины n, anetvⁿ, применение операции преобразования
  в ассоциативную сеть вложенных упорядоченных пар и обратное преобразование обратно
  в ассоциативную сеть кортежей длины n обеспечивает восстановление исходной сети anetvⁿ.
  Иначе говоря:

  ∀ anetvⁿ : Link → Tⁿ, обратно(вперёд(anetvⁿ)) = anetvⁿ.
*)
Theorem TupleFunctionEquivalenceAfterTransforms : forall {n: nat} (anet: AssociativeNetworkTupleFunction n),
  TupleFunctionEquivalence anet (fun id => match LinkListToTupleOfLinksOption n ((TupleFunctionToLinkListFunction anet) id) with
  | Some t => t
  | None => anet id
  end).
Proof.
  intros n net id.
  unfold TupleFunctionToLinkListFunction.
  simpl.
  rewrite LinkListToTupleOfLinksInverse.
  reflexivity.
Qed.


(* Лемма о сохранении длины списков LinkList в ассоциативной сети дуплетов *)
Lemma LinkListDimensionPreserved : forall (offset: nat) (np: LinkList),
  length np = length (LinkListToDupletList_ offset np).
Proof.
  intros offset np.
  generalize dependent offset.
  induction np as [| n np' IHnp']; intros offset.
  - simpl. reflexivity.
  - destruct np' as [| m np'']; simpl; simpl in IHnp'.
  + reflexivity.
  + rewrite IHnp' with (offset := S offset). reflexivity.
Qed.
