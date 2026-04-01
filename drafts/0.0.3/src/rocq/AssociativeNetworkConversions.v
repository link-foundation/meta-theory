Require Import PeanoNat.
Require Import Coq.Init.Nat.
Require Import Vector.
Require Import List.
Require Import Coq.Init.Datatypes.
Import ListNotations.
Import VectorNotations.
Require Import AssociativeNetworkDefinitions.

(* Функция преобразования TupleOfLinks в LinkList *)
Fixpoint TupleOfLinksToLinkList {n : nat} (v : TupleOfLinks n) : LinkList :=
  match v with
  | Vector.nil _ => List.nil
  | Vector.cons _ h _ t => List.cons h (TupleOfLinksToLinkList t)
  end.

(* Функция преобразования AssociativeNetworkTupleFunction в AssociativeNetworkLinkListFunction *)
Definition TupleFunctionToLinkListFunction {n : nat} (a: AssociativeNetworkTupleFunction n) : AssociativeNetworkLinkListFunction :=
  fun id => TupleOfLinksToLinkList (a id).

(* Функция преобразования AssociativeNetworkTupleList в AssociativeNetworkLinkListList *)
Definition TupleListToLinkListList {n: nat} (net: AssociativeNetworkTupleList n) : AssociativeNetworkLinkListList :=
  map TupleOfLinksToLinkList net.

(* Функция преобразования LinkList в TupleOfLinks, возвращающая option *)
Fixpoint LinkListToTupleOfLinksOption (n: nat) (p: LinkList) : option (TupleOfLinks n) :=
  match n, p with
  | 0, List.nil => Some (Vector.nil nat)
  | S n', List.cons f p' =>
  match LinkListToTupleOfLinksOption n' p' with
  | None => None
  | Some t => Some (Vector.cons nat f n' t)
  end
  | _, _ => None
  end.

(* Функция преобразования LinkList в TupleOfLinks с использованием TupleOfLinksDefault *)
Definition LinkListToTupleOfLinks (n: nat) (p: LinkList) : TupleOfLinks n :=
  match LinkListToTupleOfLinksOption n p with
  | None => TupleOfLinksDefault n
  | Some t => t
  end.

(* Функция преобразования AssociativeNetworkLinkListFunction в AssociativeNetworkTupleFunction *)
Definition LinkListFunctionToTupleFunction { n: nat } (net: AssociativeNetworkLinkListFunction) : AssociativeNetworkTupleFunction n :=
  fun id => match LinkListToTupleOfLinksOption n (net id) with
  | Some t => t
  | None => TupleOfLinksDefault n
  end.

(* Функция преобразования AssociativeNetworkLinkListList в AssociativeNetworkTupleList *)
Definition LinkListListToTupleList {n: nat} (net : AssociativeNetworkLinkListList) : AssociativeNetworkTupleList n :=
  map (LinkListToTupleOfLinks n) net.

(* Функция преобразования LinkList в AssociativeNetworkDupletList со смещением индексации *)
Fixpoint LinkListToDupletList_ (offset: nat) (np: LinkList) : AssociativeNetworkDupletList :=
  match np with
  | nil => nil
  | cons h nil => cons (h, offset) nil
  | cons h t => cons (h, S offset) (LinkListToDupletList_ (S offset) t)
  end.

(* Функция преобразования LinkList в AssociativeNetworkDupletList *)
Definition LinkListToDupletList (np: LinkList) : AssociativeNetworkDupletList := LinkListToDupletList_ 0 np.

(* Функция добавления LinkList в хвост AssociativeNetworkDupletList *)
Definition AddLinkListToDupletList (anet: AssociativeNetworkDupletList) (np: LinkList) : AssociativeNetworkDupletList :=
  app anet (LinkListToDupletList_ (length anet) np).

(* Функция отрезает голову anetd и возвращает хвост начиная с offset *)
Fixpoint DupletListBehead (anet: AssociativeNetworkDupletList) (offset : nat) : AssociativeNetworkDupletList :=
  match offset with
  | 0 => anet
  | S n' =>
  match anet with
  | nil => nil
  | cons h t => DupletListBehead t n'
  end
  end.

(* Функция преобразования AssociativeNetworkDupletList в LinkList с индексацией в начале AssociativeNetworkDupletList начиная с offset *)
Fixpoint DupletListToLinkList_ (anet: AssociativeNetworkDupletList) (offset: nat) (index: nat): LinkList :=
  match anet with
  | nil => nil
  | cons (x, next_index) tail_anet =>
  if offset =? index then
  cons x (DupletListToLinkList_ tail_anet (S offset) next_index)
  else
  DupletListToLinkList_ tail_anet (S offset) index
  end.

(* Функция чтения LinkList из AssociativeNetworkDupletList по индексу дуплета *)
Definition DupletListReadLinkList (anet: AssociativeNetworkDupletList) (index: nat) : LinkList :=
  DupletListToLinkList_ anet 0 index.

(* Функция преобразования AssociativeNetworkDupletList в LinkList начиная с головы списка ассоциативной сети *)
Definition DupletListToLinkList (anet: AssociativeNetworkDupletList) : LinkList := DupletListReadLinkList anet 0.

(*
  Теперь всё готово для преобразования ассоциативной сети вложенных упорядоченных пар anetl : Link → LinkList
  в ассоциативную сеть дуплетов anetd : Link → Link².

  Данное преобразование можно делать по-разному: с сохранением исходных ссылок на кортежи
  либо с переиндексацией. Переиндексацию можно не делать, если написать дополнительную функцию для
  ассоциативной сети дуплетов, которая возвращает вложенную упорядоченную пару по её ссылке.
*)

(* Функция добавления AssociativeNetworkLinkListList в AssociativeNetworkDupletList *)
Fixpoint AddLinkListListToDupletList (anetd: AssociativeNetworkDupletList) (anetl: AssociativeNetworkLinkListList) : AssociativeNetworkDupletList :=
  match anetl with
  | nil => anetd
  | cons h t => AddLinkListListToDupletList (AddLinkListToDupletList anetd h) t
  end.

(* Функция преобразования AssociativeNetworkLinkListList в AssociativeNetworkDupletList *)
Definition LinkListListToDupletList (anetl: AssociativeNetworkLinkListList) : AssociativeNetworkDupletList :=
  match anetl with
  | nil => nil
  | cons h t => AddLinkListListToDupletList (LinkListToDupletList h) t
  end.

(* Функция поиска LinkList в хвосте AssociativeNetworkDupletList начинающемуся с offset по её порядковому номеру.
   Возвращает offset LinkList. *)
Fixpoint DupletListOffsetLinkList_ (anet: AssociativeNetworkDupletList) (offset: nat) (index: nat) : nat :=
  match anet with
  | nil => offset + (length anet)
  | cons (_, next_index) tail_anet =>
  match index with
  | O => offset
  | S index' =>
  if offset =? next_index then
  DupletListOffsetLinkList_ tail_anet (S offset) index'
  else
  DupletListOffsetLinkList_ tail_anet (S offset) index
  end
  end.

(* Функция поиска LinkList в AssociativeNetworkDupletList по её порядковому номеру. Возвращает offset LinkList. *)
Definition DupletListOffsetLinkList (anet: AssociativeNetworkDupletList) (index: nat) : nat :=
  DupletListOffsetLinkList_ anet 0 index.

(* Функция преобразования AssociativeNetworkTupleList в AssociativeNetworkDupletList *)
Definition TupleListToDupletList {n : nat} (anetv: AssociativeNetworkTupleList n) : AssociativeNetworkDupletList :=
  LinkListListToDupletList (TupleListToLinkListList anetv).

(*
  Теперь всё готово для преобразования ассоциативной сети дуплетов anetd : Link → Link²
  в ассоциативную сеть вложенных упорядоченных пар anetl : Link → LinkList.

  Данное преобразование будем делать с сохранением исходных ссылок на кортежи.
  Переиндексацию можно не делать, потому что есть функция DupletListOffsetLinkList для
  ассоциативной сети дуплетов, которая возвращает смещение вложенной УП по ссылке на неё.
*)

(* Функция отрезает первую LinkList из AssociativeNetworkDupletList и возвращает хвост *)
Fixpoint DupletListBeheadLinkList (anet: AssociativeNetworkDupletList) (offset: nat) : AssociativeNetworkDupletList :=
  match anet with
  | nil => nil
  | cons (_, next_index) tail_anet =>
  if offset =? next_index then (* конец LinkList *)
  tail_anet
  else (* ещё не конец LinkList *)
  DupletListBeheadLinkList tail_anet (S offset)
  end.

(* Функция преобразования LinkList и AssociativeNetworkDupletList со смещения offset в AssociativeNetworkLinkListList *)
Fixpoint DupletListToLinkListList_ (anetd: AssociativeNetworkDupletList) (np: LinkList) (offset: nat) : AssociativeNetworkLinkListList :=
  match anetd with
  | nil => nil (* отбрасываем LinkList даже если она недостроена *)
  | cons (x, next_index) tail_anet =>
  if offset =? next_index then (* конец LinkList, переходим к следующей LinkList *)
  cons (app np (cons x nil)) (DupletListToLinkListList_ tail_anet nil (S offset))
  else (* ещё не конец LinkList, парсим ассоциативную сеть дуплетов дальше *)
  DupletListToLinkListList_ tail_anet (app np (cons x nil)) (S offset)
  end.

(* Функция преобразования AssociativeNetworkDupletList в AssociativeNetworkLinkListList *)
Definition DupletListToLinkListList (anetd: AssociativeNetworkDupletList) : AssociativeNetworkLinkListList :=
  DupletListToLinkListList_ anetd nil LinkDefault.
