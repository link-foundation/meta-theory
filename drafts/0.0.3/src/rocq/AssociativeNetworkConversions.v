Require Import PeanoNat.
Require Import Coq.Init.Nat.
Require Import Vector.
Require Import List.
Require Import Coq.Init.Datatypes.
Import ListNotations.
Import VectorNotations.
Require Import AssociativeNetworkDefinitions.

(* Функция преобразования TupleOfLinks в NestedPair *)
Fixpoint TupleOfLinksToNestedPair {n : nat} (v : TupleOfLinks n) : NestedPair :=
  match v with
  | Vector.nil _ => List.nil
  | Vector.cons _ h _ t => List.cons h (TupleOfLinksToNestedPair t)
  end.

(* Функция преобразования AssociativeNetworkTupleFunction в AssociativeNetworkNestedPairFunction *)
Definition TupleFunctionToNestedPairFunction {n : nat} (a: AssociativeNetworkTupleFunction n) : AssociativeNetworkNestedPairFunction :=
  fun id => TupleOfLinksToNestedPair (a id).

(* Функция преобразования AssociativeNetworkTupleList в AssociativeNetworkNestedPairList *)
Definition TupleListToNestedPairList {n: nat} (net: AssociativeNetworkTupleList n) : AssociativeNetworkNestedPairList :=
  map TupleOfLinksToNestedPair net.

(* Функция преобразования NestedPair в TupleOfLinks, возвращающая option *)
Fixpoint NestedPairToTupleOfLinksOption (n: nat) (p: NestedPair) : option (TupleOfLinks n) :=
  match n, p with
  | 0, List.nil => Some (Vector.nil nat)
  | S n', List.cons f p' =>
  match NestedPairToTupleOfLinksOption n' p' with
  | None => None
  | Some t => Some (Vector.cons nat f n' t)
  end
  | _, _ => None
  end.

(* Функция преобразования NestedPair в TupleOfLinks с использованием TupleOfLinksDefault *)
Definition NestedPairToTupleOfLinks (n: nat) (p: NestedPair) : TupleOfLinks n :=
  match NestedPairToTupleOfLinksOption n p with
  | None => TupleOfLinksDefault n
  | Some t => t
  end.

(* Функция преобразования AssociativeNetworkNestedPairFunction в AssociativeNetworkTupleFunction *)
Definition NestedPairFunctionToTupleFunction { n: nat } (net: AssociativeNetworkNestedPairFunction) : AssociativeNetworkTupleFunction n :=
  fun id => match NestedPairToTupleOfLinksOption n (net id) with
  | Some t => t
  | None => TupleOfLinksDefault n
  end.

(* Функция преобразования AssociativeNetworkNestedPairList в AssociativeNetworkTupleList *)
Definition NestedPairListToTupleList {n: nat} (net : AssociativeNetworkNestedPairList) : AssociativeNetworkTupleList n :=
  map (NestedPairToTupleOfLinks n) net.

(* Функция преобразования NestedPair в AssociativeNetworkDupletList со смещением индексации *)
Fixpoint NestedPairToDupletList_ (offset: nat) (np: NestedPair) : AssociativeNetworkDupletList :=
  match np with
  | nil => nil
  | cons h nil => cons (h, offset) nil
  | cons h t => cons (h, S offset) (NestedPairToDupletList_ (S offset) t)
  end.

(* Функция преобразования NestedPair в AssociativeNetworkDupletList *)
Definition NestedPairToDupletList (np: NestedPair) : AssociativeNetworkDupletList := NestedPairToDupletList_ 0 np.

(* Функция добавления NestedPair в хвост AssociativeNetworkDupletList *)
Definition AddNestedPairToDupletList (anet: AssociativeNetworkDupletList) (np: NestedPair) : AssociativeNetworkDupletList :=
  app anet (NestedPairToDupletList_ (length anet) np).

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

(* Функция преобразования AssociativeNetworkDupletList в NestedPair с индексацией в начале AssociativeNetworkDupletList начиная с offset *)
Fixpoint DupletListToNestedPair_ (anet: AssociativeNetworkDupletList) (offset: nat) (index: nat): NestedPair :=
  match anet with
  | nil => nil
  | cons (x, next_index) tail_anet =>
  if offset =? index then
  cons x (DupletListToNestedPair_ tail_anet (S offset) next_index)
  else
  DupletListToNestedPair_ tail_anet (S offset) index
  end.

(* Функция чтения NestedPair из AssociativeNetworkDupletList по индексу дуплета *)
Definition DupletListReadNestedPair (anet: AssociativeNetworkDupletList) (index: nat) : NestedPair :=
  DupletListToNestedPair_ anet 0 index.

(* Функция преобразования AssociativeNetworkDupletList в NestedPair начиная с головы списка ассоциативной сети *)
Definition DupletListToNestedPair (anet: AssociativeNetworkDupletList) : NestedPair := DupletListReadNestedPair anet 0.

(*
  Теперь всё готово для преобразования ассоциативной сети вложенных упорядоченных пар anetl : Link → NestedPair
  в ассоциативную сеть дуплетов anetd : Link → Link².

  Данное преобразование можно делать по-разному: с сохранением исходных ссылок на кортежи
  либо с переиндексацией. Переиндексацию можно не делать, если написать дополнительную функцию для
  ассоциативной сети дуплетов, которая возвращает вложенную упорядоченную пару по её ссылке.
*)

(* Функция добавления AssociativeNetworkNestedPairList в AssociativeNetworkDupletList *)
Fixpoint AddNestedPairListToDupletList (anetd: AssociativeNetworkDupletList) (anetl: AssociativeNetworkNestedPairList) : AssociativeNetworkDupletList :=
  match anetl with
  | nil => anetd
  | cons h t => AddNestedPairListToDupletList (AddNestedPairToDupletList anetd h) t
  end.

(* Функция преобразования AssociativeNetworkNestedPairList в AssociativeNetworkDupletList *)
Definition NestedPairListToDupletList (anetl: AssociativeNetworkNestedPairList) : AssociativeNetworkDupletList :=
  match anetl with
  | nil => nil
  | cons h t => AddNestedPairListToDupletList (NestedPairToDupletList h) t
  end.

(* Функция поиска NestedPair в хвосте AssociativeNetworkDupletList начинающемуся с offset по её порядковому номеру.
   Возвращает offset NestedPair. *)
Fixpoint DupletListOffsetNestedPair_ (anet: AssociativeNetworkDupletList) (offset: nat) (index: nat) : nat :=
  match anet with
  | nil => offset + (length anet)
  | cons (_, next_index) tail_anet =>
  match index with
  | O => offset
  | S index' =>
  if offset =? next_index then
  DupletListOffsetNestedPair_ tail_anet (S offset) index'
  else
  DupletListOffsetNestedPair_ tail_anet (S offset) index
  end
  end.

(* Функция поиска NestedPair в AssociativeNetworkDupletList по её порядковому номеру. Возвращает offset NestedPair. *)
Definition DupletListOffsetNestedPair (anet: AssociativeNetworkDupletList) (index: nat) : nat :=
  DupletListOffsetNestedPair_ anet 0 index.

(* Функция преобразования AssociativeNetworkTupleList в AssociativeNetworkDupletList *)
Definition TupleListToDupletList {n : nat} (anetv: AssociativeNetworkTupleList n) : AssociativeNetworkDupletList :=
  NestedPairListToDupletList (TupleListToNestedPairList anetv).

(*
  Теперь всё готово для преобразования ассоциативной сети дуплетов anetd : Link → Link²
  в ассоциативную сеть вложенных упорядоченных пар anetl : Link → NestedPair.

  Данное преобразование будем делать с сохранением исходных ссылок на кортежи.
  Переиндексацию можно не делать, потому что есть функция DupletListOffsetNestedPair для
  ассоциативной сети дуплетов, которая возвращает смещение вложенной УП по ссылке на неё.
*)

(* Функция отрезает первую NestedPair из AssociativeNetworkDupletList и возвращает хвост *)
Fixpoint DupletListBeheadNestedPair (anet: AssociativeNetworkDupletList) (offset: nat) : AssociativeNetworkDupletList :=
  match anet with
  | nil => nil
  | cons (_, next_index) tail_anet =>
  if offset =? next_index then (* конец NestedPair *)
  tail_anet
  else (* ещё не конец NestedPair *)
  DupletListBeheadNestedPair tail_anet (S offset)
  end.

(* Функция преобразования NestedPair и AssociativeNetworkDupletList со смещения offset в AssociativeNetworkNestedPairList *)
Fixpoint DupletListToNestedPairList_ (anetd: AssociativeNetworkDupletList) (np: NestedPair) (offset: nat) : AssociativeNetworkNestedPairList :=
  match anetd with
  | nil => nil (* отбрасываем NestedPair даже если она недостроена *)
  | cons (x, next_index) tail_anet =>
  if offset =? next_index then (* конец NestedPair, переходим к следующей NestedPair *)
  cons (app np (cons x nil)) (DupletListToNestedPairList_ tail_anet nil (S offset))
  else (* ещё не конец NestedPair, парсим ассоциативную сеть дуплетов дальше *)
  DupletListToNestedPairList_ tail_anet (app np (cons x nil)) (S offset)
  end.

(* Функция преобразования AssociativeNetworkDupletList в AssociativeNetworkNestedPairList *)
Definition DupletListToNestedPairList (anetd: AssociativeNetworkDupletList) : AssociativeNetworkNestedPairList :=
  DupletListToNestedPairList_ anetd nil LinkDefault.
